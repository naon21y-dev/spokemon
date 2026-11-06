import {randomUUID} from 'node:crypto';
import {characters,diglett} from '../src/data/characters.js';
import {evolutionStage,evolvedCharacter,diglettForms,diglettFinalForms} from '../src/data/evolutions.js';
import {fail} from './service.mjs';
export async function hydrateCollection(db,u,pet){
 pet.collection??={};
 const records=await db.prepare("SELECT detail FROM ledger WHERE user_id=? AND kind='파트너 변경'").all(u.id);
 for(const row of records){for(const id of row.detail.split(' → '))if(characters.some(c=>c.id===id))pet.collection[id]??={completed:false}}
 // Restore legacy stage records from the latest accepted enhancement.
 const historicalStages=new Map();
 for(const event of pet.enhancement?.history??[]){
  if(event.decision==='accept'&&typeof event.success==='boolean'&&characters.some(c=>c.id===event.character)){
   historicalStages.set(event.character,event.success?event.toStage:1);
  }
 }
 for(const [id,stage] of historicalStages){
  pet.collection[id]??={completed:false};
  pet.collection[id].stage??=pet.collection[id].completed?3:stage;
 }
 if(characters.some(c=>c.id===pet.character)){
  const stage=evolutionStage(pet);
  pet.collection[pet.character]={...pet.collection[pet.character],stage,completed:stage===3};
 }
 for(const entry of Object.values(pet.collection)){
  entry.stage??=entry.completed?3:1;
 }
 return pet.collection;
}
function canViewDiglett(pet){
 return pet.character==='diglett'||Object.keys(pet.collection).some(key=>key.startsWith('diglett:')&&pet.collection[key]);
}
export async function createCollection(service){const db=service.db;const run=(q,...a)=>db.prepare(q).run(...a),get=(q,...a)=>db.prepare(q).get(...a);
 await db.exec('CREATE TABLE IF NOT EXISTS collection_receipts(user_id TEXT NOT NULL,request_key TEXT NOT NULL,target TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,request_key));');
 async function read(u){service.student(u);return db.transaction(async()=>{const user=await get('SELECT * FROM users WHERE id=? AND deleted_at IS NULL',u.id),pet=JSON.parse(user.pet);await hydrateCollection(db,user,pet);await run('UPDATE users SET pet=? WHERE id=?',JSON.stringify(pet),u.id);const forms=[{...diglett,stage:1,price:5000},...diglettForms.map(f=>({...f,stage:2,price:1000})),...diglettFinalForms.map(f=>({...f,stage:3,price:1000}))];return {characters:characters.map(c=>({...c,owned:!!pet.collection[c.id],completed:!!pet.collection[c.id]?.completed})),diglett:canViewDiglett(pet)?forms.map(f=>({...f,owned:!!pet.collection['diglett:'+f.id]})):[],canRegisterDiglett:pet.character==='diglett'&&evolutionStage(pet)===3,coins:user.coins}})}
 async function act(u,b){service.student(u);if(typeof b?.requestKey!=='string'||!/^[-\w]{8,100}$/.test(b.requestKey))fail(400,'요청을 확인해 주세요.');return db.transaction(async()=>{const old=await get('SELECT * FROM collection_receipts WHERE user_id=? AND request_key=?',u.id,b.requestKey);if(old){if(old.target!==b.target)fail(409,'요청 내용이 변경됐어요.');return JSON.parse(old.result)}const user=await get('SELECT * FROM users WHERE id=? AND deleted_at IS NULL',u.id),pet=JSON.parse(user.pet);await hydrateCollection(db,user,pet);if(!canViewDiglett(pet))fail(403,'디그다 도감을 아직 열 수 없어요.');const form=[{...diglett,stage:1},...diglettForms.map(f=>({...f,stage:2})),...diglettFinalForms.map(f=>({...f,stage:3}))].find(f=>f.id===b.target);if(!form)fail(400,'디그다 모습을 선택해 주세요.');const collectionKey='diglett:'+form.id,owned=pet.collection[collectionKey];let cost=0;
 if(!owned){if(form.stage===1){if(pet.character!=='diglett'||evolutionStage(pet)!==3)fail(403,'디그다 최종 강화를 완료한 상태에서 등록할 수 있어요.');cost=5000}else{if(!pet.collection['diglett:diglett'])fail(403,'먼저 디그다를 도감에 등록해 주세요.');cost=1000}if(user.coins<cost)fail(400,'포인트가 부족해요.');await run('UPDATE users SET coins=coins-? WHERE id=?',cost,u.id);await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),u.id,-cost,'포켓몬 도감',form.name+' 영구 등록','collection:'+u.id+':'+form.id,Date.now());pet.collection[collectionKey]={completed:true,stage:form.stage}}
 else {if(pet.character==='diglett'&&pet.diglettRecovery)fail(403,'먼저 500포인트 또는 탈출권으로 디그다를 복구해 주세요.');pet.character='diglett';pet.enhancement.stage=form.stage;pet.enhancement.diglettForm=form.stage>1?form.id:null;pet.enhancement.pending=null;pet.enhancement.queued=[];pet.enhancement.lastResult=null;pet.diglettRecovery=null;if(pet.skinByCharacter)pet.skinByCharacter.diglett='';}
 if(form.stage===1&&!owned)pet.diglettRecovery=null;await run('UPDATE users SET pet=? WHERE id=?',JSON.stringify(pet),u.id);const result={ok:true,purchased:!owned,cost};await run('INSERT INTO collection_receipts VALUES(?,?,?,?)',u.id,b.requestKey,b.target,JSON.stringify(result));return result})}
 return {read,act};}
