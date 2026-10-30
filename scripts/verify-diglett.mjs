import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {createService} from '../server/service.mjs';
import {evolvedCharacter,evolutionStage} from '../src/data/evolutions.js';
import {activeSkin} from '../src/data/skins.js';
const s=await createService(':memory:',{evolutionRoll:()=>99});
async function setup(character,stage=1,coins=3000){const u=await s.createUser({login:'dig_'+randomUUID().slice(0,8),nickname:'Diglett Test',password:'test-only-password'}),state=await s.state(u),pet=state.data.pet,id=randomUUID();Object.assign(pet,{character,xp:3900,owned:['👑'],wear:'👑',enhancement:{version:2,stage,lastOpportunityLevel:40,pending:{id,level:40,at:Date.now()},queued:[],history:[],lastResult:null}});await s.db.prepare('UPDATE users SET pet=?,coins=? WHERE id=?').run(JSON.stringify(pet),coins,u.id);return {u,id}}
try{
 for(const character of ['piplup','squirtle','gengar','bulbasaur','mew','magikarp','dratini','froakie','pichu']){
  const {u,id}=await setup(character);await Promise.all(Array.from({length:10},()=>s.petAction(u,{action:'enhance',item:id})));
  let state=await s.state(u);assert.equal(state.data.pet.character,'diglett');assert.equal(state.data.pet.diglettRecovery.character,character);assert.equal(evolvedCharacter(state.data.pet).name,'디그다');assert.equal(state.data.pet.xp,3900);assert.equal(state.data.pet.wear,'👑');assert.equal(state.data.pet.enhancement.lastResult.diglett,true);
  await assert.rejects(()=>s.updateProfile(u,{character:'piplup'}),e=>e.status===403);await assert.rejects(()=>s.petAction(u,{action:'enhance',item:randomUUID()}),e=>e.status===404);
  await s.petAction(u,{action:'skin',item:'diglett-home'});state=await s.state(u);assert.equal(activeSkin(state.data.pet).id,'diglett-home');const balance=state.data.coins;
  await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'diglett-restore',item:id})));
  state=await s.state(u);assert.equal(state.data.coins,balance-500);assert.equal(state.data.pet.character,character);assert.equal(evolutionStage(state.data.pet),1);assert.equal(state.data.pet.diglettRecovery,null);assert.equal(state.data.pet.xp,3900);assert(state.data.pet.ownedSkins.includes('diglett-home'));assert.equal(activeSkin(state.data.pet),null);
  assert.equal((await s.db.prepare("SELECT count(*) AS n FROM ledger WHERE unique_key=?").get("diglett-restore:"+u.id+":"+id)).n,1);
  await assert.rejects(()=>s.petAction(u,{action:'skin',item:'diglett-home'}),e=>e.status===400);
 }
 const poor=await setup('piplup',2,0);await s.petAction(poor.u,{action:'enhance',item:poor.id});await assert.rejects(()=>s.petAction(poor.u,{action:'diglett-restore',item:poor.id}),e=>e.status===400);assert.equal((await s.state(poor.u)).data.pet.character,'diglett');
 const decline=await setup('gengar',2);await s.petAction(decline.u,{action:'enhance-decline',item:decline.id});assert.equal((await s.state(decline.u)).data.pet.character,'gengar');
 for(const file of ['public/images/characters/diglett.png','public/images/skins/diglett/home.png','public/images/skins/diglett/home-shiny.png','public/images/skins/diglett/shiny.png'])assert.equal(readFileSync(file).subarray(1,4).toString(),'PNG');
 console.log('PASS: nine families fail to Diglett; concurrent failure/recovery charged once; 500P restore; skin ownership preserved and isolated; no profile bypass; insufficient balance rollback; decline unchanged; PNG assets valid.');
}finally{await s.close()}
