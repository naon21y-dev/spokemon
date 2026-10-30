import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {petCondition,petMood} from '../src/data/petCare.js';
import {evolvedCharacter,diglettForms} from '../src/data/evolutions.js';
import {activeSkin} from '../src/data/skins.js';
import {queueEnhancements} from '../server/evolution.mjs';
const now=Date.now();
const wet=petCondition({hunger:100,happy:100,last:now-12*3600000},now);
assert.equal(wet.hunger,64);assert.equal(wet.happy,76);assert(petMood(wet).rainy);
assert.deepEqual(petMood({hunger:40,happy:40}).messages,['배고파요','우울해요']);
assert.equal(petMood({hunger:41,happy:41}).rainy,false);
for(let choice=0;choice<3;choice++){
 const s=await createService(':memory:',{clock:()=>now,diglettRoll:()=>choice});
 try{
  const u=await s.createUser({login:'trio_test',nickname:'테스트',password:'test-only-password'});
  let st=await s.state(u),p=st.data.pet;const recovery=randomUUID();
  Object.assign(p,{character:'diglett',xp:895,hunger:70,happy:75,last:now,longAbsence:true,diglettRecovery:{id:recovery,character:'squirtle'},enhancement:{version:2,stage:1,lastOpportunityLevel:0,pending:null,queued:[],history:[],lastResult:null}});
  await s.db.prepare('UPDATE users SET pet=?,coins=? WHERE id=?').run(JSON.stringify(p),5000,u.id);
  const key=randomUUID();await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'train',requestKey:key})));
  st=await s.state(u);p=st.data.pet;assert.equal(p.xp,945);assert.equal(st.data.coins,4970);assert.equal(p.hunger,70);assert.equal(p.happy,75);assert.equal(p.longAbsence,false);assert.equal(p.enhancement.pending.level,10);
  await assert.rejects(()=>s.petAction(u,{action:'food',requestKey:key}),e=>e.status===409);
  const id=p.enhancement.pending.id;
  await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'enhance',item:id})));
  st=await s.state(u);p=st.data.pet;assert.equal(evolvedCharacter(p).formId,diglettForms[choice].id);assert.equal(p.enhancement.stage,2);assert.equal(st.data.coins,4970);assert.equal(p.diglettRecovery.id,recovery);
  assert.deepEqual(queueEnhancements(p,10,20,now),[]);
  const skin=diglettForms[choice].id+'-home';await s.petAction(u,{action:'skin',item:skin});
  st=await s.state(u);assert.equal(activeSkin(st.data.pet).id,skin);assert.equal(st.data.coins,3970);
  await assert.rejects(()=>s.petAction(u,{action:'skin',item:diglettForms[(choice+1)%3].id+'-home'}),e=>e.status===403);
  await assert.rejects(()=>s.petAction(u,{action:'skin',item:'diglett-home'}),e=>e.status===403);
  await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'diglett-restore',item:recovery})));
  st=await s.state(u);assert.equal(st.data.coins,3470);assert.equal(st.data.pet.character,'squirtle');assert.equal(st.data.pet.enhancement.stage,1);assert.equal(st.data.pet.xp,945);assert(st.data.pet.ownedSkins.includes(skin));assert.equal(activeSkin(st.data.pet),null);
  await s.db.prepare('UPDATE users SET coins=0 WHERE id=?').run(u.id);
  const before=JSON.stringify((await s.state(u)).data.pet);await assert.rejects(()=>s.petAction(u,{action:'train',requestKey:randomUUID()}),e=>e.status===400);assert.equal(JSON.stringify((await s.state(u)).data.pet),before);
 }finally{await s.close()}
}
console.log('PASS: training 30P/50XP, 20 concurrent requests once-only, insufficient rollback, low/away weather, all three random Diglett outcomes, variant skin locks, 500P restoration once-only and ownership preserved.');
