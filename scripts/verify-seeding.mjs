import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {seedingQuestions} from '../server/questions/seeding.js';
const file=join(mkdtempSync(join(tmpdir(),'spokemon-seeding-')),'test.sqlite');
let now=Date.now(),s=await createService(file,{clock:()=>now}),server;
const password=randomUUID(),admin=await s.createUser({login:'seed_admin',nickname:'관리자',password,role:'admin'}),student=await s.createUser({login:'seed_student',nickname:'도전자',password}),other=await s.createUser({login:'seed_other',nickname:'친구',password});
const cookies={};for(const u of [admin,student,other])cookies[u.id]='spokemon_session='+(await s.newSession(u)).token;
try{
 server=await createHttp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 async function call(path,u=student,method='GET',body,status=200){const r=await fetch(base+'/api'+path,{method,headers:{Cookie:cookies[u.id],'Content-Type':'application/json','X-Spokemon-Request':'1'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.equal(r.status,status,JSON.stringify(data));return data}
 assert.equal(seedingQuestions.length,184);assert.equal(new Set(seedingQuestions.map(q=>q.id)).size,184);assert(seedingQuestions.every(q=>q.explanation&&q.acceptedAnswers.length));
 assert((await call('/seeding/settings')).enabled);
 const config=await call('/seeding/settings');assert.equal(config.questionCount,25);assert.deepEqual(config.subjects.map(s=>s.id),['numpy-pandas','tensorflow']);
 for(const subject of config.subjects)for(const type of ['multiple','short']){const bank=seedingQuestions.filter(q=>q.subject===subject.id&&q.type===type);assert.equal(bank.length,subject.count);if(type==='multiple')for(const q of bank){assert.equal(q.options.length,4);assert.equal(new Set(q.options.map(o=>o.text)).size,4);assert(q.options.some(o=>o.id===q.correctOptionId))}}
 const study = await call('/seeding/study');
 assert.equal(study.cards.length,92);
 for (const subject of config.subjects) {
  const cards = study.cards.filter(card => card.subject === subject.id);
  assert.equal(cards.length,subject.count);
  assert(cards.every(card => card.prompt && card.answer && card.explanation));
 }
 assert.equal((await fetch(base+'/api/seeding/study')).status,401);
 await call('/seeding/study',admin,'GET',undefined,403);
 const studyBeat = (seq,visible,subject='tensorflow',status=200) => call('/study/heartbeat',other,'POST',{
  tabId:'seeding-cards',seq,visible,activityAgeMs:0,context:{kind:'seeding-study',subject}
 },status);
 await studyBeat(1,true,'unknown',400);
 assert.equal((await studyBeat(1,true)).owner,true);
 now += 10000;
 assert.equal((await studyBeat(2,false)).addedMs,10000);
  await call('/seeding/start',student,'POST',{subject:'unknown',type:'short'},400);
 await call('/seeding/start',student,'POST',{subject:'tensorflow',type:'all'},400);
 const modeIds=new Set();let otherBalance=(await s.state(other)).data.coins;
 for(const subject of config.subjects)for(const type of ['multiple','short']){
  const payload={subject:subject.id,type},g=await call('/seeding/start',other,'POST',payload);modeIds.add(g.id);assert.equal(g.subject,subject.id);assert.equal(g.type,type);assert(g.questions.every(q=>q.type===type&&seedingQuestions.find(b=>b.id===q.id).subject===subject.id));
  const resumed=await call('/seeding?'+new URLSearchParams(payload),other);assert.equal(resumed.session.id,g.id);assert.deepEqual((await call('/seeding/start',other,'POST',payload)).questions,g.questions);
  const b=new Map(seedingQuestions.map(q=>[q.id,q]));const responses=Object.fromEntries(g.questions.map(q=>[q.id,type==='multiple'?b.get(q.id).correctOptionId:b.get(q.id).acceptedAnswers[0]]));
  if(type==='multiple'){assert(g.questions.every(q=>!('correctOptionId' in q)&&q.options.length===4));await call('/seeding/'+g.id+'/submit',other,'POST',{answers:{[g.questions[0].id]:'not-an-option'},revision:0},400)}
  const result=await call('/seeding/'+g.id+'/submit',other,'POST',{answers:responses,revision:0});assert.equal(result.result.correct,25);otherBalance+=500;assert.equal((await s.state(other)).data.coins,otherBalance);
 }
 assert.equal(modeIds.size,4);
 for(const correctCount of [0,15,16,25]){
  const g=await call('/seeding/start',other,'POST',{subject:'tensorflow',type:'multiple'}),bank=new Map(seedingQuestions.map(q=>[q.id,q]));
  assert.equal(g.questions.length,25);const answers=Object.fromEntries(g.questions.map((q,i)=>[q.id,i<correctCount?bank.get(q.id).correctOptionId:q.options.find(o=>o.id!==bank.get(q.id).correctOptionId).id]));
  const graded=await call('/seeding/'+g.id+'/submit',other,'POST',{answers,revision:0});assert.equal(graded.result.score,correctCount*4);assert.equal(graded.result.outcome,correctCount<=15?'retake':'pass');assert.equal(graded.result.coins,500);
  assert(!(await call('/activity/notifications',other)).events.some(e=>e.kind==='points'&&e.reason==="GT's seeding 완료"));
 }
 // Already-started 30-question sets remain intact; starting now creates a separate 25-question set.
 const oldId=randomUUID(),oldQuestions=seedingQuestions.filter(q=>q.subject==='numpy-pandas'&&q.type==='short').slice(0,30).map(q=>({id:q.id}));
 await s.db.prepare('INSERT INTO seeding_sessions(id,user_id,questions,created_at,subject,type) VALUES(?,?,?,?,?,?)').run(oldId,other.id,JSON.stringify(oldQuestions),now+1,'numpy-pandas','short');
 const fresh=await call('/seeding/start',other,'POST',{subject:'numpy-pandas',type:'short'});assert.notEqual(fresh.id,oldId);assert.equal(fresh.questions.length,25);
 const oldAnswers=Object.fromEntries(oldQuestions.map(q=>[q.id,seedingQuestions.find(b=>b.id===q.id).acceptedAnswers[0]]));
 const oldResult=await call('/seeding/'+oldId+'/submit',other,'POST',{answers:oldAnswers,revision:0});assert.equal(oldResult.result.total,30);assert.equal(oldResult.result.score,100);assert.equal(oldResult.result.outcome,'pass');


 await call('/admin/seeding',student,'PUT',{enabled:false},403);
 const initial=(await call('/activity/notifications')).events.filter(e=>e.kind==='seeding-open');assert.equal(initial.length,1);
 await call('/activity/notifications/read',student,'POST',{ids:[initial[0].id]});assert.equal((await call('/activity/notifications')).events.filter(e=>e.kind==='seeding-open').length,0);
 const [a,b]=await Promise.all([call('/seeding/start',student,'POST',{}),call('/seeding/start',student,'POST',{})]);assert.equal(a.id,b.id);assert.equal(a.questions.length,25);assert.equal(new Set(a.questions.map(q=>q.id)).size,25);assert(!JSON.stringify(a).includes('acceptedAnswers'));assert(a.questions.every(q=>!('correctAnswer' in q)&&!('explanation' in q)));
 await call('/seeding/'+a.id+'/draft',other,'POST',{answers:{},revision:0},404);
 await call('/seeding/'+a.id+'/submit',student,'POST',{answers:{},revision:0},400);
 await call('/seeding/'+a.id+'/draft',student,'POST',{answers:{invalid:'x'},revision:0},400);
 const bank=new Map(seedingQuestions.map(q=>[q.id,q])),answers=Object.fromEntries(a.questions.map(q=>[q.id,bank.get(q.id).acceptedAnswers[0].toUpperCase().split('').join(' ')]));
 const draft=await call('/seeding/'+a.id+'/draft',student,'POST',{answers,revision:0});assert.equal(draft.revision,1);assert.deepEqual((await call('/seeding')).session.answers,answers);
 await call('/seeding/'+a.id+'/draft',student,'POST',{answers:{},revision:0},409);
 const beat=(seq,extra={})=>call('/study/heartbeat',student,'POST',{tabId:'seeding-test',seq,visible:true,activityAgeMs:0,context:{kind:'seeding',sessionId:a.id},...extra});
 await beat(1);for(let i=2;i<=242;i++){now+=30000;const r=await beat(i);assert.equal(r.addedMs,30000)}
 assert.equal((await s.db.prepare('SELECT SUM(ms) ms FROM study_days WHERE user_id=?').get(student.id)).ms,7230000);
 assert((await call('/legendary')).checks.find(c=>c.id==='study').done);
 const draw={kind:'draw',condition:'study',requestKey:randomUUID()};const first=await call('/legendary/claim',student,'POST',draw);assert.deepEqual(await call('/legendary/claim',student,'POST',draw),first);await call('/legendary/claim',student,'POST',{...draw,requestKey:randomUUID()},409);
 const before=(await s.state(student)).data.coins;
 const results=await Promise.all(Array.from({length:4},()=>call('/seeding/'+a.id+'/submit',student,'POST',{answers,revision:1})));
 assert(results.every(r=>r.result.coins===500&&r.result.correct===25));assert.equal((await s.state(student)).data.coins,before+500);assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM ledger WHERE unique_key=?").get('seeding:'+a.id)).n,1);
 const second=await call('/seeding/start',student,'POST',{});assert.notEqual(second.id,a.id);
 const body={title:'시험 안내',content:'첨부 자료로 공부해 주세요!',requestKey:randomUUID(),attachmentIds:[]};
 const post=await call('/sloud',admin,'POST',body);assert.deepEqual(await call('/sloud',admin,'POST',body),post);
 const userPost=await call('/sloud',student,'POST',{...body,requestKey:randomUUID(),title:'학생 글'});
 assert.equal((await s.db.prepare("SELECT count(*) n FROM broadcast_notices WHERE kind='sloud-notice'").get()).n,1);
 const list=await call('/sloud');assert.equal(list.items[0].id,post.id);assert.equal(list.items[0].role,'admin');
 assert((await call('/activity/notifications',other)).events.some(e=>e.target===post.id));assert(!(await call('/activity/notifications',other)).events.some(e=>e.target===userPost.id));
 assert((await call('/timeline?offset=0')).items.some(e=>e.kind==='sloud-notice'&&e.target===post.id));
 await call('/sloud/'+post.id,admin,'DELETE');assert(!(await call('/activity/notifications',other)).events.some(e=>e.target===post.id));assert(!(await call('/timeline?offset=0')).items.some(e=>e.target===post.id));
 await call('/admin/seeding',admin,'PUT',{enabled:false});assert.equal((await call('/seeding')).session,null);await call('/seeding/study',student,'GET',undefined,403);await studyBeat(3,true,'tensorflow',403);await call('/seeding/start',student,'POST',{},403);await call('/seeding/'+second.id+'/submit',student,'POST',{answers:{},revision:0},403);
 await call('/study/heartbeat',student,'POST',{tabId:'seeding-test',seq:243,visible:true,activityAgeMs:0,context:{kind:'seeding',sessionId:second.id}},403);
 assert(!(await call('/activity/notifications',other)).events.some(e=>e.kind==='seeding-open'));
 now++;await call('/admin/seeding',admin,'PUT',{enabled:true});await call('/admin/seeding',admin,'PUT',{enabled:true});assert.equal((await call('/activity/notifications',other)).events.filter(e=>e.kind==='seeding-open').length,1);assert.equal((await call('/seeding')).session.id,second.id);
 await new Promise(r=>server.close(r));server=null;await s.close();s=await createService(file,{clock:()=>now});assert((await s.seeding.settings(admin)).enabled);assert.equal((await s.seeding.read(student)).session.id,second.id);assert.equal((await s.db.prepare('SELECT count(*) n FROM seeding_sessions WHERE user_id=?').get(student.id)).n,2);

 const savedCoins=(await s.state(student)).data.coins;
 await s.db.exec('DROP INDEX seeding_group; ALTER TABLE seeding_sessions DROP COLUMN subject; ALTER TABLE seeding_sessions DROP COLUMN type;');
 await s.close();s=await createService(file,{clock:()=>now});const legacy=await s.seeding.read(student);assert.equal(legacy.session.id,second.id);assert.equal(legacy.session.subject,'legacy');assert.equal((await s.state(student)).data.coins,savedCoins);
 const oldDone=await s.seeding.submit(student,a.id,{answers:{},revision:-1});assert.equal(oldDone.result.coins,500);assert.equal((await s.state(student)).data.coins,savedCoins);
 console.log('PASS: 2 document subjects x 2 formats (184 variants); legacy migration; 92 source questions, 25-at-once, draft persistence/conflict, answer privacy, ownership, concurrent 500P exactly once, study heartbeat + 2h legendary, admin settings/access, Sloud notices + deletion + deduplication, latest re-open notification, restart persistence.');
}finally{if(server)await new Promise(r=>server.close(r));await s.close()}
