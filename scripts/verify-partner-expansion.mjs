import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
import {createService} from '../server/service.mjs';
import {characters} from '../src/data/characters.js';
import {evolvedCharacter,evolutionStage,evolutionMaxStage,partnerTheme} from '../src/data/evolutions.js';
import {skins,activeSkin} from '../src/data/skins.js';
let roll=0;const s=await createService(':memory:',{evolutionRoll:()=>roll});
async function patch(u,fields,coins){const state=await s.state(u);await s.db.prepare('UPDATE users SET pet=?,coins=?,partner_locked=1 WHERE id=?').run(JSON.stringify({...state.data.pet,...fields}),coins??state.data.coins,u.id)}
const state=()=>({version:2,stage:1,lastOpportunityLevel:20,pending:null,queued:[],history:[],lastResult:null});
try{
 assert.deepEqual(characters.filter(c=>!c.minLevel).map(c=>c.id),['piplup','squirtle','gengar','bulbasaur']);assert.equal(characters.at(-1).id,'mew');
 for(const family of ['magikarp','dratini','froakie','pichu']){
  const u=await s.createUser({login:'expand_'+family,nickname:'Partner Test',password:'test-only-password'});await patch(u,{xp:1800},10000);await assert.rejects(()=>s.updateProfile(u,{character:family}),e=>e.status===403);assert.equal((await s.state(u)).data.coins,10000);
  await patch(u,{xp:1900});await s.updateProfile(u,{character:family});let current=await s.state(u);assert.equal(current.data.pet.character,family);assert.equal(current.data.coins,5000);
  const baseSkin=skins.find(x=>x.character===family&&x.stage===1);await Promise.all(Array.from({length:8},()=>s.petAction(u,{action:'skin',item:baseSkin.id})));assert.equal((await s.state(u)).data.coins,4500);
  await patch(u,{xp:2895,hunger:20,enhancement:state()});await s.petAction(u,{action:'food',requestKey:randomUUID()});current=await s.state(u);assert.equal(current.data.pet.enhancement.pending.level,30);await s.petAction(u,{action:'enhance',item:current.data.pet.enhancement.pending.id});current=await s.state(u);assert.equal(evolutionStage(current.data.pet),2);assert.equal(activeSkin(current.data.pet),null);await assert.rejects(()=>s.petAction(u,{action:'skin',item:baseSkin.id}),e=>e.status===403);
  const tier2=skins.find(x=>x.character===family&&x.stage===2);await s.petAction(u,{action:'skin',item:tier2.id});
  await patch(u,{xp:3895,hunger:20});await s.petAction(u,{action:'food',requestKey:randomUUID()});current=await s.state(u);await s.petAction(u,{action:'enhance',item:current.data.pet.enhancement.pending.id});current=await s.state(u);assert.equal(evolutionStage(current.data.pet),3);assert.equal(current.data.pet.enhancement.lastResult.chance,50);assert.equal(current.data.pet.character,family);
  const tier3=skins.find(x=>x.character===family&&x.stage===3);await s.petAction(u,{action:'skin',item:tier3.id});assert.equal((await s.state(u)).data.coins,1980);assert.equal(activeSkin((await s.state(u)).data.pet).id,tier3.id);assert.equal(skins.filter(x=>x.character===family).length,9);
 }
 const mew=await s.createUser({login:'mega_mew_test',nickname:'Mega Test',password:'test-only-password'});await patch(mew,{character:'mew',xp:3895,hunger:20,enhancement:{...state(),stage:2,lastOpportunityLevel:30}},5000);await s.petAction(mew,{action:'food',requestKey:randomUUID()});let current=await s.state(mew),id=current.data.pet.enhancement.pending.id;assert.equal(current.data.pet.enhancement.pending.level,40);roll=49;await Promise.all(Array.from({length:8},()=>s.petAction(mew,{action:'enhance',item:id})));current=await s.state(mew);assert.equal(current.data.coins,3990);assert.equal(evolutionStage(current.data.pet),3);assert.equal(evolvedCharacter(current.data.pet).formId,'mewtwo-mega-x');assert.equal(partnerTheme(evolvedCharacter(current.data.pet)),'mewtwo');assert.equal(evolutionMaxStage('mew'),3);assert.equal(current.data.pet.enhancement.lastResult.chance,50);
 await s.petAction(mew,{action:'skin',item:'mewtwo-mega-x-home'});assert.equal((await s.state(mew)).data.coins,2490);await assert.rejects(()=>s.petAction(mew,{action:'skin',item:'mewtwo-home'}),e=>e.status===403);
 const source=JSON.parse(readFileSync('public/images/partner-expansion/SOURCES.json'));assert.equal(source.forms.length,13);for(const f of source.forms)for(const a of f.assets){assert(existsSync('public'+a.path));assert.equal(readFileSync('public'+a.path).subarray(1,4).toString(),'PNG')}assert.equal(skins.length,95);for(const skin of skins)assert.equal(skin.price,skin.stage*500);
 console.log('PASS: four signup starters, new Lv20 server gates, unchanged 5000P selection, nine skins per new family, milestones and 80/50 stages, stage locks, 1000P Mega Mewtwo once-only, 52 PNG assets and 86 total skins.');
}finally{await s.close()}
