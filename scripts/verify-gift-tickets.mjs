import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
const file=join(mkdtempSync(join(tmpdir(),'spokemon-tickets-')),'app.sqlite');let s=await createService(file),server;
try{
 const password='test-only-password',a=await s.createUser({login:'ticket_admin',nickname:'선생님',password,role:'admin'}),u=await s.createUser({login:'ticket_student',nickname:'학생',password}),v=await s.createUser({login:'ticket_other',nickname:'다른학생',password});
 let pet=(await s.state(u)).data.pet;Object.assign(pet,{character:'piplup',xp:1900,owned:['👑'],wear:'👑',ownedSkins:['piplup-01'],skinByCharacter:{piplup:'piplup-01'}});await s.db.prepare('UPDATE users SET coins=0,pet=?,partner_locked=1 WHERE id=?').run(JSON.stringify(pet),u.id);
 const body={kind:'partner-change',quantity:2,message:'잘했어요!',requestKey:randomUUID()};
 await assert.rejects(()=>s.tickets.send(u,v.id,body),e=>e.status===403);await assert.rejects(()=>s.tickets.send(a,a.id,body),e=>e.status===404);
 for(const bad of [{...body,quantity:0},{...body,quantity:1.5},{...body,quantity:100},{...body,kind:'coins'},{...body,requestKey:''}])await assert.rejects(()=>s.tickets.send(a,u.id,bad),e=>e.status===400);
 const sent=await Promise.all(Array.from({length:20},()=>s.tickets.send(a,u.id,body))),id=sent[0].id;assert(sent.every(g=>g.id===id));assert.equal((await s.tickets.list(u)).pending.length,1);assert.equal((await s.tickets.list(v)).pending.length,0);assert.equal((await s.state(u)).data.tickets.length,0);
 await assert.rejects(()=>s.tickets.send(a,u.id,{...body,quantity:1}),e=>e.status===409);await assert.rejects(()=>s.tickets.claim(v,id),e=>e.status===404);
 await assert.rejects(()=>s.updateProfile(u,{character:'squirtle',ticketId:id,requestKey:randomUUID()}),e=>e.status===409);
 await Promise.all(Array.from({length:20},()=>s.tickets.claim(u,id)));assert.equal((await s.state(u)).data.tickets[0].remaining,2);
 await assert.rejects(()=>s.updateProfile(u,{character:'mew',ticketId:id,requestKey:randomUUID()}),e=>e.status===403);assert.equal((await s.state(u)).data.tickets[0].remaining,2);
 const key=randomUUID();await Promise.all(Array.from({length:20},()=>s.updateProfile(u,{character:'squirtle',ticketId:id,requestKey:key})));let st=await s.state(u);assert.equal(st.data.coins,0);assert.equal(st.data.pet.character,'squirtle');assert.equal(st.data.tickets[0].remaining,1);assert.equal(st.data.pet.xp,1900);assert.deepEqual(st.data.pet.owned,['👑']);assert.deepEqual(st.data.pet.ownedSkins,['piplup-01']);
 await assert.rejects(()=>s.updateProfile(u,{character:'gengar',ticketId:id,requestKey:key}),e=>e.status===409);
 await s.db.exec("CREATE TRIGGER ticket_rollback BEFORE UPDATE OF pet ON users BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
 await assert.rejects(()=>s.updateProfile(u,{character:'gengar',ticketId:id,requestKey:randomUUID()}));assert.equal((await s.state(u)).data.tickets[0].remaining,1);assert.equal((await s.state(u)).data.pet.character,'squirtle');await s.db.exec('DROP TRIGGER ticket_rollback');
 await s.updateProfile(u,{character:'gengar',ticketId:id,requestKey:randomUUID()});await s.tickets.claim(u,id);assert.equal((await s.state(u)).data.tickets.length,0);await assert.rejects(()=>s.updateProfile(u,{character:'piplup',ticketId:id,requestKey:randomUUID()}),e=>e.status===409);
 const escape=await s.tickets.send(a,u.id,{kind:'diglett-escape',quantity:2,message:'탈출 선물',requestKey:randomUUID()});await s.tickets.claim(u,escape.id);
 await assert.rejects(()=>s.updateProfile(u,{character:'piplup',ticketId:escape.id,requestKey:randomUUID()}),e=>e.status===409);
 pet=(await s.state(u)).data.pet;Object.assign(pet,{character:'diglett',diglettRecovery:{id:'recovery-ticket',character:'gengar'},enhancement:{version:2,stage:2,diglettForm:'dugtrio',lastOpportunityLevel:10,pending:null,queued:[],history:[],lastResult:null}});await s.db.prepare('UPDATE users SET pet=? WHERE id=?').run(JSON.stringify(pet),u.id);
 await assert.rejects(()=>s.petAction(u,{action:'diglett-restore',item:'recovery-ticket',ticketId:id,requestKey:randomUUID()}),e=>e.status===409);
 const escapeKey=randomUUID();await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'diglett-restore',item:'recovery-ticket',ticketId:escape.id,requestKey:escapeKey})));st=await s.state(u);assert.equal(st.data.pet.character,'gengar');assert.equal(st.data.pet.enhancement.stage,1);assert.equal(st.data.coins,0);assert.equal(st.data.tickets[0].remaining,1);assert.equal(st.data.pet.xp,1900);assert(st.data.pet.owned.includes('👑'));
 await s.db.prepare('UPDATE users SET coins=6000 WHERE id=?').run(u.id);await s.updateProfile(u,{character:'piplup'});assert.equal((await s.state(u)).data.coins,1000);
 await s.close();s=await createService(file);assert.equal((await s.state(u)).data.tickets[0].remaining,1);assert.equal((await s.tickets.read(a,u.id)).gifts.length,2);
 server=await createHttp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,tokens={};for(const user of [a,u,v])tokens[user.id]=(await s.newSession(user)).token;
 async function req(user,path,method='GET',body){return fetch(base+'/api'+path,{method,headers:{Cookie:'spokemon_session='+(tokens[user?.id]??''),'Content-Type':'application/json','X-Spokemon-Request':'1'},body:body?JSON.stringify(body):undefined})}
 assert.equal((await req(null,'/tickets')).status,401);assert.equal((await req(v,'/tickets/'+escape.id+'/claim','POST')).status,404);assert.equal((await req(u,'/admin/students/'+u.id+'/gifts')).status,403);assert.equal((await req(u,'/admin/students/'+v.id+'/gifts','POST',body)).status,403);assert.equal((await req(a,'/admin/students/'+u.id+'/gifts')).status,200);assert.equal((await req(u,'/tickets')).status,200);
 console.log('PASS: admin-only gifts, recipient ACLs, 20 concurrent grants/claims/redemptions once-only, invalid inputs, level gates, wrong/empty tickets, no point cost, ownership preserved, transactional rollback, paid path unchanged and DB persistence.');
}finally{if(server)await new Promise(r=>server.close(r));await s.close()}
