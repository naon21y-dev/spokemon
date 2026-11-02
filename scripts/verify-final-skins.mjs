import assert from 'node:assert/strict';
import {createService} from '../server/service.mjs';
import {skins,activeSkin} from '../src/data/skins.js';
import {partnerBounds,groundClearance} from '../src/data/partnerGrounding.js';
import {accessoryAnchors,skinAccessoryAnchors} from '../src/data/accessoryAnchors.js';
const s=await createService(':memory:');
try{
 const u=await s.createUser({login:'finalskin_test',nickname:'스킨검증',password:'test-only-password'});
 const finals=skins.filter(x=>x.character==='diglett'&&x.stage===3);assert.equal(finals.length,3);
 for(const skin of finals){
  const pet=(await s.state(u)).data.pet;Object.assign(pet,{character:'diglett',xp:3000,last:Date.now(),ownedSkins:[],skinByCharacter:{},enhancement:{version:2,stage:3,diglettForm:skin.formId,lastOpportunityLevel:30,pending:null,queued:[],history:[],lastResult:null}});
  await s.db.prepare('UPDATE users SET coins=10000,pet=? WHERE id=?').run(JSON.stringify(pet),u.id);
  await Promise.all(Array.from({length:20},()=>s.petAction(u,{action:'skin',item:skin.id})));
  let st=await s.state(u);assert.equal(st.data.coins,8500);assert.equal(activeSkin(st.data.pet).id,skin.id);assert.equal(st.data.pet.ownedSkins.filter(x=>x===skin.id).length,1);
  await s.petAction(u,{action:'skin',item:'default'});await s.petAction(u,{action:'skin',item:skin.id});assert.equal((await s.state(u)).data.coins,8500);
  await assert.rejects(()=>s.petAction(u,{action:'skin',item:finals.find(x=>x.id!==skin.id).id}),e=>e.status===403);
  await assert.rejects(()=>s.petAction(u,{action:'skin',item:'diglett-shiny'}),e=>e.status===403);
  assert(skinAccessoryAnchors[skin.id]);assert.equal(skin.price,1500);
 }
 for(const [image,b] of Object.entries(partnerBounds))for(const ratio of [1,.8,1.2]){const scale=Math.min(1,ratio/b.ratio);const paintedBottom=(1-scale)/2+b.bottom*scale;assert(Math.abs(paintedBottom+groundClearance(image,ratio)/100-1)<1e-8)}
 console.log('PASS: 3 final-form skins at 1500P; 20 concurrent purchases charged once; rewear free; wrong forms/stages blocked; 180 image bounds grounded.');
}finally{await s.close()}

