import {createGameRankings} from './game-rankings.mjs';
import {randomUUID,randomInt} from 'node:crypto';
import {fail} from './service.mjs';
import {cardLevels} from '../src/data/card-levels.js';
const TTL=2*3600000;
export async function createCardGame(service,{checkpointMs=1500,maxCached=500}={}){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS card_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,level INTEGER NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,request_key));`);
 const rankings=await createGameRankings(service),sessions=new Map(),gates=new Map();
 const clone=g=>JSON.parse(JSON.stringify(g));
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 function view(row,g){const shown=new Set([...g.open,...g.matched]);return {id:row.id,level:row.level,cards:g.deck.map((v,i)=>shown.has(i)?v:null),open:[...g.open],matched:[...g.matched],tries:g.tries,done:g.done,elapsedMs:g.done?(g.durationMs??null):Math.max(0,Date.now()-row.created_at),durationMs:g.durationMs??null,reward:g.done?cardLevels[row.level-1].reward:0};}
 // Keep the hidden deck and live decisions on the server. Remote checkpoints never block a reveal.
 function checkpoint(entry){
  clearTimeout(entry.timer);entry.timer=null;if(entry.g.done)return entry.writer;
  const snapshot=JSON.stringify(entry.g),revision=entry.g.revision??0;
  entry.writer=entry.writer.catch(()=>{}).then(()=>db.prepare("UPDATE card_sessions SET state=? WHERE id=? AND user_id=? AND json_extract(state,'$.done')=0 AND COALESCE(json_extract(state,'$.revision'),0)<=?").run(snapshot,entry.row.id,entry.row.user_id,revision));
  entry.writer.catch(()=>{});return entry.writer;
 }
 function schedule(entry){if(!entry.timer){entry.timer=setTimeout(()=>checkpoint(entry),checkpointMs);entry.timer.unref?.()}}
 function remember(row,g){
  if(sessions.size>=maxCached){const candidate=[...sessions].find(([id])=>!gates.has(id));if(candidate){const [id,old]=candidate;checkpoint(old).catch(()=>{});sessions.delete(id)}}
  const entry={row,g,timer:null,writer:Promise.resolve()};sessions.set(row.id,entry);return entry;
 }
 async function serial(id,fn){const before=gates.get(id)??Promise.resolve();let release;const next=new Promise(r=>release=r);gates.set(id,next);await before;try{return await fn()}finally{release();if(gates.get(id)===next)gates.delete(id)}}
 async function start(u,b){
  service.student(u);const level=b?.level,key=b?.requestKey;
  if(!Number.isInteger(level)||level<1||level>cardLevels.length||typeof key!=='string'||!/^[-\w]{8,100}$/.test(key))fail(400,'게임 레벨을 확인해 주세요.');
  const created=await db.transaction(async()=>{
   const old=await db.prepare('SELECT * FROM card_sessions WHERE user_id=? AND request_key=?').get(u.id,key);
   if(old){if(old.level!==level)fail(409,'시작 요청이 바뀌었어요.');return {row:old,g:JSON.parse(old.state)}}
   const order=shuffle(Array.from({length:9},(_,i)=>i)),pairs=Array.from({length:cardLevels[level-1].pairs},(_,i)=>order[i%9]);
   const g={deck:shuffle(pairs.flatMap(x=>[x,x])),open:[],matched:[],tries:0,done:false,hideAt:0,revision:0},row={id:randomUUID(),user_id:u.id,level,created_at:Date.now()};
   await db.prepare('INSERT INTO card_sessions VALUES(?,?,?,?,?,?)').run(row.id,u.id,key,level,JSON.stringify(g),row.created_at);
   return {row,g};
  });const entry=sessions.get(created.row.id)??remember(created.row,created.g);return view(entry.row,entry.g);
 }
 async function flip(u,id,b){
  service.student(u);
  return serial(id,async()=>{
   let entry=sessions.get(id);
   if(!entry){const row=await db.prepare('SELECT * FROM card_sessions WHERE id=? AND user_id=?').get(id,u.id);if(!row)fail(404,'내 카드게임을 찾을 수 없어요.');entry=remember(row,JSON.parse(row.state))}
   const row=entry.row;if(row.user_id!==u.id)fail(404,'내 카드게임을 찾을 수 없어요.');
   if(Date.now()-row.created_at>TTL){clearTimeout(entry.timer);sessions.delete(id);fail(410,'게임 시간이 만료됐어요. 새 게임을 시작해 주세요.')}
   const g=clone(entry.g),i=b?.index,key=b?.requestKey,c=cardLevels[row.level-1];
   if(key!=null&&(typeof key!=='string'||!/^[-\w]{8,100}$/.test(key)))fail(400,'카드 선택 요청을 확인해 주세요.');
   if(!Number.isInteger(i)||i<0||i>=g.deck.length)fail(400,'카드를 확인해 주세요.');
   const prior=key&&g.requests?.find(request=>request.key===key);if(prior&&prior.index!==i)fail(409,'같은 카드 요청의 내용이 바뀌었어요.');if(g.done||prior)return view(row,g);
   if(g.open.length===2&&Date.now()>=g.hideAt)g.open=[];
   if(g.open.length===2||g.open.includes(i)||g.matched.includes(i))return view(row,g);
   g.open.push(i);if(key)g.requests=[...(g.requests??[]),{key,index:i}].slice(-256);g.revision=(g.revision??0)+1;
   if(g.open.length===2){g.tries++;const [a,z]=g.open;if(g.deck[a]===g.deck[z]){g.matched.push(a,z);g.open=[];g.done=g.matched.length===g.deck.length}else g.hideAt=Date.now()+c.delay;}
   if(g.done){
    clearTimeout(entry.timer);entry.timer=null;await entry.writer.catch(()=>{});
    const completedAt=Date.now();g.durationMs=Math.max(1,completedAt-row.created_at);
    const committed=await db.transaction(async()=>{
     const stored=await db.prepare('SELECT state FROM card_sessions WHERE id=? AND user_id=?').get(id,u.id);if(!stored)fail(404,'내 카드게임을 찾을 수 없어요.');const prior=JSON.parse(stored.state);if(prior.done)return prior;
     await rankings.record({game:'cards',sessionId:id,userId:u.id,level:row.level,durationMs:g.durationMs,metric:g.tries,hints:0,completedAt});
     await db.batch([{sql:'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',args:[randomUUID(),u.id,c.reward,'카드게임 클리어','LEVEL '+c.id+' · '+c.pairs+'쌍 완성','card-clear:'+id,completedAt]},{sql:'UPDATE users SET coins=coins+? WHERE id=?',args:[c.reward,u.id]},{sql:'UPDATE card_sessions SET state=? WHERE id=?',args:[JSON.stringify(g),id]}]);return g;
    });entry.g=committed;entry.writer=Promise.resolve();
   }else{entry.g=g;schedule(entry)}
   return view(row,entry.g);
  });
 }
 async function flush(){await Promise.all([...sessions.values()].map(entry=>checkpoint(entry)))}
 return {start,flip,flush};
}
