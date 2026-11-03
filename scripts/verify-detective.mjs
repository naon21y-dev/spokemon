import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {createDetective} from '../server/detective/service.mjs';
import {makeCase} from '../server/detective/questions.mjs';
import {runSQL} from '../server/detective/sql.mjs';
const file=join(mkdtempSync(join(tmpdir(),'spokemon-detective-')),'test.sqlite');let s=await createService(file),now=Date.now(),d=await createDetective(s,{clock:()=>now}),server;
const key=()=>randomUUID();
try{
 const hashes=new Set();let validated=0;
 for(let level=1;level<=5;level++)for(let iteration=0;iteration<5;iteration++){
  const c=makeCase(level);assert.equal(c.fixture.suspects.length,5);assert(c.fixture.suspects.some(x=>x.id===c.culprit));
  for(const q of c.questions){assert(!hashes.has(q.hash));hashes.add(q.hash);if(q.type==='multiple'){assert.equal(q.options.length,5);assert.equal(new Set(q.options.map(o=>o.label)).size,5)}
   const v=await runSQL({fixture:c.fixture,reference:q.sql,sql:q.sql,requiredTables:q.requiredTables});assert(v.correct,JSON.stringify(v));assert(Array.isArray(v.rows));validated++;
  }
 }
 const c=makeCase(5),q=c.questions[3],job={fixture:c.fixture,reference:q.sql,requiredTables:q.requiredTables};
 for(const sql of ['DELETE FROM suspects','SELECT * FROM users',"SELECT load_extension('bad')", "SELECT * FROM suspects; DELETE FROM suspects", "ATTACH DATABASE '/etc/passwd' AS stolen",'PRAGMA database_list','SELECT randomblob(1000000000)','SELECT * FROM sqlite_master','SELECT 1 FROM suspects a, suspects b, suspects c, suspects d, suspects e, suspects f, suspects g, suspects h, suspects i, suspects j']){
  const result=await runSQL({...job,sql});assert.equal(result.correct,false,sql);
 }
 const changed=await runSQL({...job,sql:q.sql.replace(' = ', ' = ')});assert(changed.correct);
 const admin=await s.createUser({login:'sql_admin',nickname:'관리자',password:'test-only-password',role:'admin'}),u=await s.createUser({login:'sql_student',nickname:'탐정',password:'test-only-password'}),other=await s.createUser({login:'sql_other',nickname:'다른탐정',password:'test-only-password'});
 await s.db.prepare('UPDATE users SET coins=777 WHERE id=?').run(u.id);
 await assert.rejects(()=>d.start(admin,{requestKey:key()}),e=>e.status===403);
 const firstKey=key();let g=await d.start(u,{requestKey:firstKey});assert.equal((await d.start(u,{requestKey:firstKey})).id,g.id);assert.equal(g.unlocked,1);assert(!JSON.stringify(g).includes('correctOptionId'));assert(!('culprit' in g.case));assert(!('sql' in g.case.question));
 await assert.rejects(()=>d.enter(u,g.id,{level:5}),e=>e.status===403);await assert.rejects(()=>d.view(other,g.id),e=>e.status===404);await assert.rejects(()=>d.accuse(u,g.id,{answer:'1',requestKey:key()}),e=>e.status===403);
 await d.pause(u,g.id,{paused:true});await assert.rejects(()=>d.answer(u,g.id,{questionId:g.case.question.id,answer:'bad',requestKey:key()}),e=>e.status===409);await d.pause(u,g.id,{paused:false});
 const wrong=await d.answer(u,g.id,{questionId:g.case.question.id,answer:'bad',requestKey:key()});assert.equal(wrong.correct,false);assert(wrong.hint);assert.equal(wrong.explanation,'');assert.equal(wrong.session.case.solved,0);
 async function solve(game,concurrent){for(let level=1;level<=5;level++){
  if(level>1)game=await d.enter(u,game.id,{level});
  for(let i=0;i<4;i++){const row=await s.db.prepare('SELECT state FROM detective_sessions WHERE id=?').get(game.id),internal=JSON.parse(row.state).cases[level-1],q=internal.questions[i];const body={questionId:q.id,answer:q.type==='multiple'?q.correctOptionId:q.type==='blank'?' '+q.answer.toLowerCase()+' ':q.sql,requestKey:key()};const result=await d.answer(u,game.id,body);assert(result.correct);assert.equal(result.reward,0);game=result.session;assert.equal(game.case.solved,i+1);assert.equal(game.case.clues.length,i+1);if(i===0)await assert.rejects(()=>d.answer(u,game.id,{...body,requestKey:key()}),e=>e.status===409)}
  const row=await s.db.prepare('SELECT state FROM detective_sessions WHERE id=?').get(game.id),internal=JSON.parse(row.state).cases[level-1];const bad=internal.fixture.suspects.find(s=>s.id!==internal.culprit).id;const miss=await d.accuse(u,game.id,{answer:String(bad),requestKey:key()});assert(!miss.correct);assert(!miss.session.case.captured);
  const body={answer:String(internal.culprit),requestKey:key()};let result;if(concurrent){const replies=await Promise.all(Array.from({length:20},()=>d.accuse(u,game.id,body)));result=replies[0];assert.equal(replies.reduce((a,r)=>a+r.reward,0),[5,15,30,50,100][level-1]);await assert.rejects(()=>d.accuse(u,game.id,{...body,answer:String(bad)}),e=>e.status===409)}else result=await d.accuse(u,game.id,body);
  game=result.session;assert(game.cleared.includes(level));
 }return game}
 g=await solve(g,true);assert(g.done);assert.equal(g.earned,200);assert.equal((await s.state(u)).data.coins,977);assert((await d.history(u)).badge);assert.equal((await d.history(u)).total,200);
 const before=new Set((await s.db.prepare('SELECT hash FROM detective_seen WHERE user_id=?').all(u.id)).map(x=>x.hash));
 await d.end(u,g.id);await assert.rejects(()=>d.view(u,g.id),e=>e.status===409);
 // Advance rate clock for the next whole playthrough, as human play would take time.
 now+=61000;let second=await d.start(u,{requestKey:key()});assert.equal(second.level,1);assert.equal(second.unlocked,1);assert.equal(second.case.solved,0);assert.equal(second.case.clues.length,0);
 const allSeen=await s.db.prepare('SELECT hash FROM detective_seen WHERE user_id=?').all(u.id);assert.equal(allSeen.filter(x=>!before.has(x.hash)).length,20);await solve(second,false);assert.equal((await s.state(u)).data.coins,977);
 assert.equal((await s.db.prepare("SELECT count(*) n FROM ledger WHERE user_id=? AND kind='SQL 미스터리 탐정단'").get(u.id)).n,5);
 await d.reset(u);await assert.rejects(()=>d.view(u,second.id),e=>e.status===409);now+=61000;const third=await d.start(u,{requestKey:key()});now+=2*3600000+1;await assert.rejects(()=>d.view(u,third.id),e=>e.status===409);
 await s.close();s=await createService(file);d=await createDetective(s);assert.equal((await d.history(u)).total,200);assert((await d.history(u)).badge);
 server=await createHttp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,ut=(await s.newSession(u)).token,at=(await s.newSession(admin)).token;
 const req=(token,path,body)=>fetch(base+'/api/detective'+path,{method:body?'POST':'GET',headers:{Cookie:'spokemon_session='+(token??''),'Content-Type':'application/json','X-Spokemon-Request':'1'},body:body?JSON.stringify(body):undefined});
 assert.equal((await req(null,'/history')).status,401);assert.equal((await req(at,'/start',{requestKey:key()})).status,403);assert.equal((await req(ut,'/history')).status,200);const session=await(await req(ut,'/start',{requestKey:key()})).json();assert.equal((await req(ut,'/'+session.id+'/enter',{level:5})).status,403);
 console.log('PASS: '+validated+' real SQL variants, five options, private answers, SQL read-only/authorizer/progress/memory limits, role/user checks, level locks, no premature accusation, pause/reset/expiry, random cases, wrong-answer hints, 100 concurrent reward requests, exactly 200P lifetime, replay no extra rewards, persistent ledger/history/SQL MASTER, authenticated HTTP endpoints.');
}finally{if(server)await new Promise(r=>server.close(r));await s.close()}
