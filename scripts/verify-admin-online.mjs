import assert from 'node:assert/strict';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
const service=await createService(':memory:'),server=await createHttp(service);
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const base='http://127.0.0.1:'+server.address().port+'/api',password='test-only-password';
async function call(path,cookie='',body){return fetch(base+path,{method:body?'POST':'GET',headers:{'Content-Type':'application/json','X-Spokemon-Request':'1',Origin:'http://127.0.0.1:5188',Cookie:cookie},body:body?JSON.stringify(body):undefined})}
async function login(login){const response=await call('/auth/login','',{login,password});assert.equal(response.status,200);return response.headers.get('set-cookie').split(';')[0]}
try{
 await service.createUser({login:'online_admin',nickname:'Teacher',password,role:'admin'});
 const student=await service.createUser({login:'online_student',nickname:'Learner',password});
 const adminCookie=await login('online_admin'),studentCookie=await login('online_student');
 assert.equal((await call('/presence',studentCookie,{active:true})).status,200);
 assert.equal((await call('/admin/online')).status,401);
 assert.equal((await call('/admin/online',studentCookie)).status,403);
 const adminResponse=await call('/admin/online',adminCookie);assert.equal(adminResponse.status,200);const roster=await adminResponse.json();assert.equal(roster.items.length,1);assert.equal(roster.items[0].id,student.id);assert.equal(roster.items[0].login,'online_student');assert.equal(roster.items[0].nickname,'Learner');assert(roster.items[0].className);
 for(const cookie of ['',studentCookie]){const publicRoster=await (await call('/online',cookie)).json();assert.equal(publicRoster.items.length,1);assert.deepEqual(Object.keys(publicRoster.items[0]).sort(),['character','stage','wear'])}
 await service.db.prepare('UPDATE presence SET seen_at=0').run();assert.equal((await (await call('/admin/online',adminCookie)).json()).items.length,0);
 console.log('PASS: admin sees online names/login/cohort; guests and students denied; public roster anonymous; expired presence excluded.');
}finally{await new Promise(r=>server.close(r));await service.close()}
