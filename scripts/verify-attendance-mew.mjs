import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {createService} from '../server/service.mjs';
import {evolutionMaxStage,evolutionStage} from '../src/data/evolutions.js';
import {skins} from '../src/data/skins.js';
let now=Date.UTC(2026,9,29,15),roll=79,draws=0;
const file=join(mkdtempSync(join(tmpdir(),'spokemon-attendance-')),'test.sqlite');
let s=await createService(file,{clock:()=>now,evolutionRoll:()=>{draws++;return roll}});
const u=await s.createUser({login:'attend_student',nickname:'출석학생',password:'test-only-1234'}),a=await s.createUser({login:'attend_admin',nickname:'출석관리자',password:'test-only-1234',role:'admin'}),other=await s.createUser({login:'attend_other',nickname:'다른학생',password:'test-only-1234'});
try{
 await assert.rejects(()=>s.attendance.checkIn(a),e=>e.status===403);
 const first=await Promise.all(Array.from({length:10},()=>s.attendance.checkIn(u)));
 assert.equal(first.reduce((n,x)=>n+x.awarded,0),5);assert.equal(first[0].day,'2026-10-30');
 for(let day=2;day<=7;day++){now+=86400000;const r=await s.attendance.checkIn(u);assert.equal(r.streak,day);assert.equal(r.awarded,day===7?105:5)}
 assert.equal((await s.state(u)).data.coins,135);assert.equal((await s.attendance.checkIn(u)).awarded,0);
 now+=86400000;assert.equal((await s.attendance.checkIn(u)).streak,1);
 now+=2*86400000;const reset=await s.attendance.checkIn(u);assert.equal(reset.streak,1);assert.equal(reset.cycle,3);
 assert.equal((await s.attendance.checkIn(other)).streak,1);
 // Korea midnight: one millisecond before midnight is the same day, one after is a new day.
 now=Date.parse(reset.day+'T14:59:59.999Z');assert.equal((await s.attendance.checkIn(u)).awarded,0);now++;assert.equal((await s.attendance.checkIn(u)).streak,2);
 const oldDay=(await s.attendance.checkIn(u)).day;await s.close();s=await createService(file,{clock:()=>now,evolutionRoll:()=>{draws++;return roll}});assert.equal((await s.attendance.checkIn(u)).awarded,0);assert.equal((await s.attendance.checkIn(u)).day,oldDay);
 async function patch(fields,coins=10000){const state=await s.state(u);await s.db.prepare('UPDATE users SET pet=?,coins=?,partner_locked=1 WHERE id=?').run(JSON.stringify({...state.data.pet,...fields}),coins,u.id)}
 await patch({xp:2899});await assert.rejects(()=>s.updateProfile(u,{character:'mew'}),e=>e.status===403);assert.equal((await s.state(u)).data.coins,10000);
 await patch({xp:2900});await s.updateProfile(u,{character:'mew'});let state=await s.state(u);assert.equal(state.data.pet.character,'mew');assert.equal(state.data.coins,5000);assert.equal(state.data.pet.enhancement.pending.level,30);assert.equal(evolutionMaxStage('mew'),2);
 const id=state.data.pet.enhancement.pending.id;draws=0;
 await Promise.all(Array.from({length:8},()=>s.petAction(u,{action:'enhance',item:id})));
 state=await s.state(u);assert.equal(draws,1);assert.equal(state.data.coins,4000);assert.equal(evolutionStage(state.data.pet),2);
 assert.equal((await s.db.prepare("SELECT COUNT(*) n FROM ledger WHERE user_id=? AND kind='파트너 강화'").get(u.id)).n,1);
 await assert.rejects(()=>s.petAction(u,{action:'skin',item:'mew-home'}),e=>e.status===403);
 await s.petAction(u,{action:'skin',item:'mewtwo-home'});assert.equal((await s.state(u)).data.coins,3000);
 const pending=()=>({version:2,stage:1,lastOpportunityLevel:30,pending:{id:randomUUID(),level:30,at:now},queued:[],history:[],lastResult:null});
 let enhancement=pending();await patch({enhancement},999);draws=0;await assert.rejects(()=>s.petAction(u,{action:'enhance',item:enhancement.pending.id}),e=>e.status===400);assert.equal(draws,0);assert.equal((await s.state(u)).data.coins,999);
 enhancement=pending();await patch({enhancement},2000);roll=80;await s.petAction(u,{action:'enhance',item:enhancement.pending.id});state=await s.state(u);assert.equal(state.data.coins,1000);assert.equal(evolutionStage(state.data.pet),1);assert.equal(state.data.pet.character,'diglett');await s.petAction(u,{action:'diglett-restore',item:state.data.pet.diglettRecovery.id});assert.equal((await s.state(u)).data.coins,500);
 enhancement=pending();await patch({enhancement},2000);await s.petAction(u,{action:'enhance-decline',item:enhancement.pending.id});assert.equal((await s.state(u)).data.coins,2000);
 await patch({enhancement:pending()},15000);await s.updateProfile(u,{character:'squirtle'});state=await s.state(u);assert.equal(state.data.pet.character,'squirtle');assert.equal(evolutionStage(state.data.pet),1);
 assert.equal(skins.filter(x=>x.character==='mew').length,6);for(const skin of skins.filter(x=>x.character==='mew'))assert.equal(skin.price,skin.stage*500);
 console.log('PASS: KST daily uniqueness, 10 concurrent check-ins, 7-day +105P, cycle renewal, missed-day reset, restart, admin excluded; Lv30 gate, Mew unlock, 1000P fee, 80% boundary, replay-once charge, insufficient balance, decline, final stage and skin locks.');
}finally{await s.close()}
