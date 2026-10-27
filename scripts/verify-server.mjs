import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {createService,kstDay,unitOf} from '../server/service.mjs'
import {createHttp} from '../server/http.mjs'
import {questions,questionMap,subjects} from '../server/questions/index.js'
let now=Date.UTC(2026,9,26,14,59,55)
const service=createService(':memory:',{clock:()=>now}),password=randomBytes(18).toString('base64url')
const admin=service.createUser({login:'test_teacher',nickname:'검증 관리자',password,role:'admin'})
const server=createHttp(service);await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port
async function call(path,{method='GET',body,cookie,origin='http://127.0.0.1:5188'}={}){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','X-Spokemon-Request':'1',Origin:origin,...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const post=(path,body,cookie)=>call(path,{method:'POST',body,cookie}),put=(path,body,cookie)=>call(path,{method:'PUT',body,cookie})
try{
 assert.equal(questions.length,700);assert.equal(new Set(questions.map(q=>q.id)).size,700)
 for(const s of subjects){assert.equal(questions.filter(q=>q.subject===s.id).length,100);for(let unit=1;unit<=5;unit++)assert.equal(questions.filter(q=>q.subject===s.id&&unitOf(q)===unit).length,20)}
 assert.equal((await post('/auth/register',{login:'bad_admin',password,nickname:'권한공격',role:'admin'})).status,403)
 const teacher=await post('/auth/login',{login:admin.login,password}),tc=teacher.cookie
 const registered=await post('/auth/register',{login:'student_one',nickname:'첫학생',password,classId:'fake',coins:99999}),sc=registered.cookie,sid=registered.data.user.id
 const registered2=await post('/auth/register',{login:'student_two',nickname:'둘학생',password}),sc2=registered2.cookie,sid2=registered2.data.user.id
 assert.equal(registered.data.user.role,'student');assert.equal(registered.data.user.classId,'unassigned');assert.equal(registered.data.data.coins,0)
 assert.equal((await call('/admin/dashboard',{cookie:sc})).status,403);assert.equal((await call('/me')).status,401)
 assert.equal((await call('/profile',{method:'PATCH',cookie:sc,body:{nickname:'위조'},origin:'https://evil.example'})).status,403)
 assert.equal((await call('/summary',{cookie:sc})).data.percent,0);assert.equal((await call('/lesson/vue/1',{cookie:sc})).status,403);assert.equal((await post('/quiz/start',{subject:'vue',type:'all'},sc)).status,403)
 const classroom=await post('/admin/classes',{name:'검증반'},tc);assert.equal(classroom.status,200)
 assert.equal((await put('/admin/students/'+sid+'/class',{classId:classroom.data.id},sc)).status,403)
 await put('/admin/students/'+sid+'/class',{classId:classroom.data.id},tc)
 await put('/admin/releases',{classId:classroom.data.id,subject:'vue',maxUnit:1},tc)
 const summary=(await call('/summary',{cookie:sc})).data;assert.equal(summary.total,20);assert.equal(summary.completed,0)
 assert.equal((await call('/lesson/vue/2',{cookie:sc})).status,403);assert.equal((await post('/quiz/start',{subject:'vue',type:'all',unit:2},sc)).status,403)
 assert.equal((await post('/quiz/start',{subject:'vue',type:'all'},sc2)).status,403)
 const started=await post('/quiz/start',{subject:'vue',type:'all'},sc);assert.equal(started.status,200);assert.equal(started.data.questionIds.length,20);assert.ok(started.data.questionIds.every(id=>unitOf(questionMap[id])===1));assert.equal(started.data.question.explanation,undefined);assert.equal(started.data.question.correctOptionId,undefined);assert.equal(started.data.question.acceptedAnswers,undefined)
 const q=questionMap[started.data.questionIds[0]],wrong=q.type==='multiple'?q.options.find(o=>o.id!==q.correctOptionId).id:'오답',correct=q.type==='multiple'?q.correctOptionId:q.acceptedAnswers[0]
 assert.equal((await call('/quiz/'+started.data.id,{cookie:sc2})).status,404)
 assert.equal((await post('/quiz/'+started.data.id+'/submit',{questionId:q.id,answer:''},sc)).status,400)
 const wrongResponses=await Promise.all(Array.from({length:5},()=>post('/quiz/'+started.data.id+'/submit',{questionId:q.id,answer:wrong},sc)));assert.ok(wrongResponses.every(r=>r.status===200))
 assert.equal((await call('/learning',{cookie:sc})).data.mistakes[q.id].wrongCount,1)
 const r1=(await post('/review/start',{ids:[q.id]},sc)).data,r2=(await post('/review/start',{ids:[q.id]},sc)).data
 const paid=await Promise.all([...Array.from({length:10},()=>post('/quiz/'+r1.id+'/submit',{questionId:q.id,answer:correct},sc)),...Array.from({length:10},()=>post('/quiz/'+r2.id+'/submit',{questionId:q.id,answer:correct},sc))]);assert.ok(paid.every(r=>r.status===200));assert.equal(paid.reduce((a,r)=>a+r.data.awarded,0),20)
 assert.equal((await call('/me',{cookie:sc})).data.data.coins,20);assert.equal((await call('/learning',{cookie:sc})).data.mistakes[q.id].reviewed,true)
 const r3=(await post('/review/start',{ids:[q.id]},sc)).data;await post('/quiz/'+r3.id+'/submit',{questionId:q.id,answer:wrong},sc);assert.equal((await call('/learning',{cookie:sc})).data.mistakes[q.id].wrongCount,2)
 await put('/games',{coins:999999,records:[{coins:99999}],card:{done:true}},sc);assert.equal((await call('/me',{cookie:sc})).data.data.coins,20);assert.equal((await post('/games/reward',{coins:99999},sc)).status,404)
 await put('/admin/releases',{classId:classroom.data.id,subject:'vue',maxUnit:0},tc)
 assert.equal((await call('/quiz/'+r3.id,{cookie:sc})).status,403);assert.equal((await post('/quiz/'+r3.id+'/submit',{questionId:q.id,answer:correct},sc)).status,403);assert.equal((await post('/review/start',{ids:[q.id]},sc)).status,403);assert.equal((await post('/complete/'+q.id,{},sc)).status,403)
 const locked=(await call('/learning',{cookie:sc})).data.mistakes[q.id];assert.equal(locked.locked,true);assert.equal(locked.question,undefined);assert.equal(locked.correctAnswer,undefined);assert.equal((await call('/summary',{cookie:sc})).data.total,0);assert.equal((await call('/me',{cookie:sc})).data.data.coins,20)
 await put('/admin/releases',{classId:classroom.data.id,subject:'vue',maxUnit:1},tc);assert.equal((await call('/summary',{cookie:sc})).data.completed,1)
 // Migration preserves the exact old point balance and is one-time/admin approved.
 const snapshot={coins:347,pet:{character:'gengar',hunger:80,happy:90,xp:220,wear:'',owned:[],last:now},records:[{coins:40}],learning:{history:[{answers:{'vue-mc-01':{correct:true}}}],mistakes:{}}}
 await post('/migration',{legacyId:'legacy-test-unique',progress:snapshot},sc2);assert.equal((await call('/me',{cookie:sc2})).data.data.coins,0)
 assert.equal((await post('/admin/students/'+sid2+'/migration',{},sc2)).status,403)
 await post('/admin/students/'+sid2+'/migration',{},tc);await post('/admin/students/'+sid2+'/migration',{},tc);assert.equal((await call('/me',{cookie:sc2})).data.data.coins,347);assert.equal((await call('/me',{cookie:sc2})).data.data.pet.xp,220)
 // Server time, KST midnight, one-tab lease, replay, hidden/idle pause, resume.
 const context={kind:'lesson',subject:'vue',unit:1};let seq=1
 const beat=(extra={})=>post('/study/heartbeat',{tabId:'tab-one',seq:seq++,visible:true,activityAgeMs:0,context,...extra},sc)
 await beat();now+=10000;const firstTime=await beat();assert.equal(firstTime.data.addedMs,10000);assert.equal((await call('/summary',{cookie:sc})).data.todaySeconds,5);assert.equal((await call('/summary',{cookie:sc})).data.totalSeconds,10)
 const other=await post('/study/heartbeat',{tabId:'tab-two',seq:1,visible:true,activityAgeMs:0,context},sc);assert.equal(other.data.owner,false);assert.equal(other.data.addedMs,0)
 const replay=await post('/study/heartbeat',{tabId:'tab-one',seq:2,visible:true,activityAgeMs:0,context},sc);assert.equal(replay.data.addedMs,0)
 now+=5000;await beat({visible:false});assert.equal((await call('/summary',{cookie:sc})).data.totalSeconds,15);now+=60000;await beat({visible:false});assert.equal((await call('/summary',{cookie:sc})).data.totalSeconds,15)
 await beat({activityAgeMs:299000});now+=10000;await beat({activityAgeMs:309000});assert.equal((await call('/summary',{cookie:sc})).data.totalSeconds,16)
 await beat();now+=10000;await beat();assert.equal((await call('/summary',{cookie:sc})).data.totalSeconds,26)
 assert.equal((await beat({context:{kind:'cards'}})).status,400)
 await put('/admin/releases',{classId:classroom.data.id,subject:'vue',maxUnit:0},tc);assert.equal((await beat()).status,403)
 const detail=await call('/admin/students/'+sid,{cookie:tc});assert.equal(detail.status,200);assert.equal(detail.data.totalSeconds,26);assert.ok(detail.data.history.length);assert.equal(detail.data.mistakes[0].wrong_count,2)
 assert.equal((await call('/admin/students/'+sid2,{cookie:sc})).status,403)
 const search=await call('/admin/dashboard?search=첫학생&classId='+classroom.data.id+'&subject=vue',{cookie:tc});assert.equal(search.data.students.length,1)
 assert.equal(kstDay(Date.UTC(2026,9,26,15)), '2026-10-27')
 console.log('PASS: 700 server-only questions; student/admin/CSRF/ownership guards; class+unit API locks; relock without record loss; 20 concurrent submissions award exactly once; no game awards; migration approval exactly once; progress denominator; server/KST time, hidden/5-minute idle/replay/multitab controls; teacher filters/details.')
}finally{await new Promise(resolve=>server.close(resolve));service.close()}
