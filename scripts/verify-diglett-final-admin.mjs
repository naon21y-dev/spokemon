import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createService} from '../server/service.mjs';import {createHttp} from '../server/http.mjs';import {evolvedCharacter,diglettFinalForms} from '../src/data/evolutions.js';
const file=join(mkdtempSync(join(tmpdir(),'trio3-admin-')),'app.sqlite');let choice=0,s=await createService(file,{diglettRoll:()=>choice}),server;
try{
 const password='test-only-password',a=await s.createUser({login:'private_admin',nickname:'관리자',password,role:'admin'}),u=await s.createUser({login:'private_student',nickname:'공개닉네임',password});
 await assert.rejects(()=>s.saveStudentPrivateName(u,u.id,{name:'비공개실명'}),e=>e.status===403);
 await s.saveStudentPrivateName(a,u.id,{name:'  비공개실명  '});assert.equal((await s.studentDetail(a,u.id)).privateName,'비공개실명');assert.equal((await s.adminData(a,{search:'비공개실명'})).students.length,1);
 assert(!JSON.stringify(await s.state(u)).includes('비공개실명'));assert(!JSON.stringify(await s.login(u.login,password)).includes('비공개실명'));
 await assert.rejects(()=>s.saveStudentPrivateName(a,u.id,{name:'x'.repeat(41)}),e=>e.status===400);
 for(choice=0;choice<3;choice++){
  const p=(await s.state(u)).data.pet,id=randomUUID(),recovery=randomUUID();Object.assign(p,{character:'diglett',xp:1895,last:Date.now(),diglettRecovery:{id:recovery,character:'piplup'},enhancement:{version:2,stage:2,diglettForm:'wugtrio',lastOpportunityLevel:10,pending:null,queued:[],history:[],lastResult:null}});
  await s.db.prepare('UPDATE users SET pet=?,coins=5000 WHERE id=?').run(JSON.stringify(p),u.id);await s.petAction(u,{action:'train',requestKey:id});const offer=(await s.state(u)).data.pet.enhancement.pending.id;
  await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'enhance',item:offer})));
  const st=await s.state(u);assert.equal(st.data.coins,4970);assert.equal(st.data.pet.enhancement.stage,3);assert.equal(evolvedCharacter(st.data.pet).formId,diglettFinalForms[choice].id);assert.equal(st.data.pet.enhancement.history.length,1);assert.equal(st.data.pet.enhancement.history[0].fromFormId,'wugtrio');assert.equal((await s.studentDetail(a,u.id)).partner.name,diglettFinalForms[choice].name);
  await s.petAction(u,{action:'diglett-restore',item:recovery});assert.equal((await s.state(u)).data.coins,4470);assert.equal((await s.state(u)).data.pet.character,'piplup');
 }
 await s.close();s=await createService(file);assert.equal((await s.studentDetail(a,u.id)).privateName,'비공개실명');
 server=await createHttp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,studentToken=(await s.newSession(u)).token,adminToken=(await s.newSession(a)).token;
 async function put(token,name){return fetch(base+'/api/admin/students/'+u.id+'/private-name',{method:'PUT',headers:{Cookie:'spokemon_session='+token,'Content-Type':'application/json','X-Spokemon-Request':'1'},body:JSON.stringify({name})})}
 assert.equal((await put('', '권한없음')).status,401);assert.equal((await put(studentToken,'권한없음')).status,403);assert.equal((await put(adminToken,'새 이름')).status,200);
 assert(!JSON.stringify(await s.state(u)).includes('새 이름'));
 console.log('PASS: three final Diglett forms, 20 concurrent upgrades once-only, 500P restore after stage3, admin Pokemon display, private name search/persistence/validation, student and anonymous API access blocked; no name in student state/login.');
}finally{if(server)await new Promise(r=>server.close(r));await s.close()}
