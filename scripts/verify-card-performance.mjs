import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setTimeout as wait} from 'node:timers/promises';
import {createService} from '../server/service.mjs';
import {createCardGame} from '../server/card-game.mjs';
import {cardLevels} from '../src/data/card-levels.js';
const s=await createService(':memory:'),handlers=[];
try{
 const u=await s.createUser({login:'fast_cards',nickname:'Speed Test',password:'test-only-password'}),other=await s.createUser({login:'other_cards',nickname:'Other Test',password:'test-only-password'});
 const cards=await createCardGame(s,{checkpointMs:60000});handlers.push(cards);
 const prepare=s.db.prepare.bind(s.db);let calls=0;
 s.db.prepare=(sql)=>{const statement=prepare(sql);return Object.fromEntries(Object.entries(statement).map(([key,fn])=>[key,async(...args)=>{calls++;return fn(...args)}]))};
 let total=0;
 for(const level of cardLevels){
  const game=await cards.start(u,{level:level.id,requestKey:randomUUID()}),raw=JSON.parse((await prepare('SELECT state FROM card_sessions WHERE id=?').get(game.id)).state);assert(game.cards.every(x=>x===null));await assert.rejects(()=>cards.flip(other,game.id,{index:0}),e=>e.status===404);
  const groups=[...Map.groupBy(raw.deck.map((face,index)=>({face,index})),x=>x.face).values()],pairs=groups.flatMap(group=>Array.from({length:group.length/2},(_,i)=>[group[i*2].index,group[i*2+1].index]));
  for(let n=0;n<pairs.length;n++){
   const [a,b]=pairs[n];calls=0;const first=await cards.flip(u,game.id,{index:a});assert(first.cards[a]!==null);assert.equal(calls,0,'Cached first flip must not query remote DB');
   if(n<pairs.length-1){const second=await cards.flip(u,game.id,{index:b});assert.equal(calls,0,'Non-final pair must not query remote DB');assert(second.matched.includes(b))}
   else {const results=await Promise.all(Array.from({length:20},()=>cards.flip(u,game.id,{index:b})));assert(results.every(r=>r.done));assert(calls>0,'Completion must persist transactionally')}
  }
  total+=level.reward;assert.equal((await s.state(u)).data.coins,total);assert.equal((await prepare('SELECT count(*) n FROM ledger WHERE unique_key=?').get('card-clear:'+game.id)).n,1);
  const stale={...raw,revision:99999};assert.equal((await prepare("UPDATE card_sessions SET state=? WHERE id=? AND json_extract(state,'$.done')=0").run(JSON.stringify(stale),game.id)).changes,0);
 }
 const resume=await cards.start(u,{level:8,requestKey:randomUUID()});const first=await cards.flip(u,resume.id,{index:0});await cards.flush();const cold=await createCardGame(s,{checkpointMs:60000});handlers.push(cold);const raw=JSON.parse((await prepare('SELECT state FROM card_sessions WHERE id=?').get(resume.id)).state),wrong=raw.deck.findIndex(v=>v!==raw.deck[0]);const mismatch=await cold.flip(u,resume.id,{index:wrong});assert.equal(mismatch.open.length,2);assert.equal(mismatch.tries,1);assert.equal(first.cards.filter(x=>x!==null).length,1);await wait(220);const next=await cold.flip(u,resume.id,{index:0});assert.deepEqual(next.open,[0]);
 const failing=await cards.start(u,{level:1,requestKey:randomUUID()}),deck=JSON.parse((await prepare('SELECT state FROM card_sessions WHERE id=?').get(failing.id)).state).deck,indices=[...Map.groupBy(deck.map((v,i)=>({v,i})),x=>x.v).values()].flatMap(group=>group.map(x=>x.i));for(const index of indices.slice(0,-1))await cards.flip(u,failing.id,{index});const batch=s.db.batch.bind(s.db);let reject=true;s.db.batch=async statements=>{if(reject&&statements.some(x=>x.sql.startsWith('UPDATE users SET coins'))){reject=false;throw Error('Simulated commit outage')}return batch(statements)};const before=(await s.state(u)).data.coins;await assert.rejects(()=>cards.flip(u,failing.id,{index:indices.at(-1)}),/Simulated/);assert.equal((await s.state(u)).data.coins,before);assert.equal((await prepare('SELECT count(*) n FROM ledger WHERE unique_key=?').get('card-clear:'+failing.id)).n,0);assert((await cards.flip(u,failing.id,{index:indices.at(-1)})).done);assert.equal((await s.state(u)).data.coins,before+3);
 const replay=await cards.start(u,{level:8,requestKey:randomUUID()}),replayDeck=JSON.parse((await prepare('SELECT state FROM card_sessions WHERE id=?').get(replay.id)).state).deck,wrongIndex=replayDeck.findIndex(v=>v!==replayDeck[0]);await cards.flip(u,replay.id,{index:0,requestKey:'first-request-key'});await cards.flip(u,replay.id,{index:wrongIndex,requestKey:'second-request-key'});await wait(220);const repeated=await cards.flip(u,replay.id,{index:wrongIndex,requestKey:'second-request-key'});await assert.rejects(()=>cards.flip(u,replay.id,{index:0,requestKey:'second-request-key'}),e=>e.status===409);assert.equal(repeated.tries,1);assert.deepEqual(repeated.open,[0,wrongIndex]);await assert.rejects(()=>cards.flip(u,replay.id,{index:0,requestKey:'bad'}),e=>e.status===400);
 console.log('PASS: all eight levels, zero DB queries on cached non-final flips, hidden deck, 20 concurrent clears award once, durable rewards/rankings, stale checkpoint protection, checkpoint resume, mismatch timing, failed commit rollback and safe retry.');
}finally{for(const handler of handlers)await handler.flush();await s.close()}
