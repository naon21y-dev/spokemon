import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createService} from '../server/service.mjs'
import {createHttp} from '../server/http.mjs'
import {createMail} from '../server/mail.mjs'
const password=randomBytes(18).toString('base64url'),dbFile=join(mkdtempSync(join(tmpdir(),'spokemon-mail-verify-')),'mail.sqlite')
let service=createService(dbFile);const teacher=service.createUser({login:'mail_teacher',password,nickname:'쪽지선생님',role:'admin'}),student=service.createUser({login:'mail_student',password,nickname:'쪽지학생'}),other=service.createUser({login:'mail_other',password,nickname:'다른학생'}),classroom=service.createClass(teacher,'비공개반');service.assignClass(teacher,student.id,classroom.id)
const server=createHttp(service);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port
async function call(path,{method='GET',body,cookie}={}){const r=await fetch(base+'/api'+path,{method,headers:{'Content-Type':'application/json','X-Spokemon-Request':'1',...(cookie?{Cookie:cookie}:{})},body:body===undefined?undefined:JSON.stringify(body)});return {status:r.status,data:await r.json(),cookie:r.headers.get('set-cookie')?.split(';')[0]}}
const post=(p,body,cookie)=>call(p,{method:'POST',body,cookie})
let messageId,secondReply
try{
 const tc=(await post('/auth/login',{login:teacher.login,password})).cookie,sc=(await post('/auth/login',{login:student.login,password})).cookie,oc=(await post('/auth/login',{login:other.login,password})).cookie
 assert.equal((await call('/messages')).status,401);assert.equal((await call('/admin/messages',{cookie:sc})).status,403)
 const body={subject:'vue',title:'ref 사용 질문',content:'ref와 reactive의 차이가 궁금해요.',requestKey:'question-key-unique',studentId:other.id}
 for(const invalid of [{...body,title:' '},{...body,content:'  '},{...body,subject:'bad'},{...body,title:'x'.repeat(101)},{...body,content:'x'.repeat(5001)},{...body,requestKey:'bad'}])assert.equal((await post('/messages',invalid,sc)).status,400)
 const responses=await Promise.all(Array.from({length:20},()=>post('/messages',body,sc)));assert.ok(responses.every(r=>r.status===200));messageId=responses[0].data.id;assert.ok(responses.every(r=>r.data.id===messageId));assert.equal(service.db.prepare('SELECT COUNT(*) n FROM private_messages').get().n,1)
 const duplicate=await post('/messages',{...body,requestKey:'question-second-click'},sc);assert.equal(duplicate.data.id,messageId);assert.equal((await post('/messages',{...body,title:'다른 제목'},sc)).status,409)
 assert.equal((await call('/messages',{cookie:oc})).data.items.length,0);assert.equal((await call('/messages',{cookie:sc})).data.items.length,1)
 assert.equal((await call('/messages/'+messageId,{cookie:oc})).status,404);assert.equal((await post('/messages/'+messageId+'/read',{replyIds:[]},oc)).status,404)
 assert.equal((await call('/messages',{cookie:tc})).status,403);assert.equal((await post('/admin/messages/'+messageId+'/reply',{content:'위조',requestKey:'student-reply-forgery'},sc)).status,403)
 const filtered=await call('/admin/messages?search=쪽지학생&classId='+classroom.id+'&subject=vue&status=pending',{cookie:tc});assert.equal(filtered.data.items.length,1);assert.equal(filtered.data.pending,1)
 assert.equal((await call('/admin/messages?subject=python',{cookie:tc})).data.items.length,0)
 assert.equal((await post('/admin/messages/'+messageId+'/reply',{content:' ',requestKey:'empty-reply-key'},tc)).status,400)
 const reply={content:'ref는 .value로 값에 접근할 수 있어요.',requestKey:'admin-reply-unique'}
 const replies=await Promise.all(Array.from({length:10},()=>post('/admin/messages/'+messageId+'/reply',reply,tc)));assert.ok(replies.every(r=>r.status===200));const firstReply=replies[0].data.id;assert.equal(service.db.prepare('SELECT COUNT(*) n FROM private_replies').get().n,1)
 assert.equal((await post('/admin/messages/'+messageId+'/reply',{...reply,requestKey:'admin-click-again'},tc)).data.id,firstReply)
 assert.equal((await call('/messages/summary',{cookie:tc})).data.pending,0);assert.equal((await call('/messages/summary',{cookie:sc})).data.unread,1)
 await call('/messages',{cookie:sc});await call('/messages/'+messageId,{cookie:sc});assert.equal((await call('/messages/summary',{cookie:sc})).data.unread,1)
 secondReply=(await post('/admin/messages/'+messageId+'/reply',{content:'추가로 reactive는 객체를 프록시로 감싸요.',requestKey:'admin-second-reply'},tc)).data.id
 const read=await post('/messages/'+messageId+'/read',{replyIds:[firstReply,firstReply]},sc);assert.equal(read.data.changed,1);assert.equal(read.data.unread,1);assert.equal((await post('/messages/'+messageId+'/read',{replyIds:[firstReply]},sc)).data.changed,0)
 assert.equal((await call('/messages/summary',{cookie:oc})).data.unread,0)
 const another=(await post('/messages',{subject:'python',title:'다른 학생 질문',content:'함수 정의가 궁금합니다.',requestKey:'another-student-question'},oc)).data.id
 const foreign=(await post('/admin/messages/'+another+'/reply',{content:'def 키워드를 사용해요.',requestKey:'other-student-answer'},tc)).data.id
 assert.equal((await post('/messages/'+messageId+'/read',{replyIds:[foreign]},sc)).data.changed,0);assert.equal((await call('/messages/summary',{cookie:oc})).data.unread,1)
 assert.equal((await call('/messages/'+messageId,{cookie:sc})).data.status,'answered');assert.equal((await call('/admin/messages?search=다른학생&subject=python&status=answered',{cookie:tc})).data.items.length,1)
}finally{await new Promise(r=>server.close(r));service.close()}
service=createService(dbFile);try{const mail=createMail(service);assert.equal(mail.list(student).items.length,1);assert.equal(mail.detail(student,messageId).replies.length,2);assert.equal(mail.summary(student).unread,1);mail.read(student,messageId,{replyIds:[secondReply]});assert.equal(mail.summary(student).unread,0)}finally{service.close()}
console.log('PASS: private ownership/admin guards, validation, 20 concurrent sends and 10 replies deduplicated, retry receipts/content mismatch, student/class/subject/status filters, pending counts, explicit per-reply reads, foreign read blocked, unread isolation and DB restart persistence.')
