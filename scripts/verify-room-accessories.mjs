import assert from 'node:assert/strict';
import {mkdtempSync} from 'node:fs';import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createService} from '../server/service.mjs';import {createRoom} from '../server/room.mjs';
import {accessoryAnchors,skinAccessoryAnchors} from '../src/data/accessoryAnchors.js';import {accessoryPlacement} from '../src/data/accessories.js';import {skins} from '../src/data/skins.js';import {evolutionChains} from '../src/data/evolutions.js';import {items} from '../src/data/items.js';
const file=join(mkdtempSync(join(tmpdir(),'spokemon-room-')),'test.sqlite');let s=await createService(file),room=await createRoom(s);
const u=await s.createUser({login:'room_student',nickname:'방테스트',password:'test-only-pass'}),v=await s.createUser({login:'room_other',nickname:'다른학생',password:'test-only-pass'}),a=await s.createUser({login:'room_admin',nickname:'관리자',password:'test-only-pass',role:'admin'});
try{
 await s.db.prepare('UPDATE users SET coins=50000 WHERE id=?').run(u.id);
 await assert.rejects(()=>room.read(a),e=>e.status===403);
 await assert.rejects(()=>room.buy(v,{itemId:'plant',quantity:1,requestKey:'poor-request-1'}),e=>e.status===400);
 const p={itemId:'plant',quantity:3,requestKey:'room-duplicate-1'};
 await Promise.all(Array.from({length:10},()=>room.buy(u,p)));
 let state=await room.read(u);assert.equal(state.inventory.length,3);assert.equal(state.balance,49850);
 await assert.rejects(()=>room.buy(u,{...p,quantity:4}),e=>e.status===409);
 const design={wall:'#ffeeff',floor:'#cceeff',grid:false,placements:state.inventory.map((i,n)=>({copyId:i.id,x:20+n*20,y:70,size:15+n*5,rotation:n*15,front:n===2}))};
 state=await room.save(u,{version:0,design});assert.equal(state.version,1);assert.deepEqual(state.design,design);
 await assert.rejects(()=>room.save(v,{version:0,design}),e=>e.status===403);
 await assert.rejects(()=>room.save(u,{version:0,design}),e=>e.status===409);
 await assert.rejects(()=>room.save(u,{version:1,design:{...design,placements:[design.placements[0],design.placements[0]]}}),e=>e.status===403);
 await assert.rejects(()=>room.save(u,{version:1,design:{...design,placements:[{...design.placements[0],size:61}]}}),e=>e.status===400);
 await room.buy(u,{itemId:'chair',quantity:99,requestKey:'chairs-99-request'});await room.buy(u,{itemId:'chair',quantity:31,requestKey:'chairs-31-request'});assert.equal((await room.read(u)).inventory.length,133);
 state=await room.save(u,{version:1,design:{...design,placements:design.placements.slice(1)}});assert.equal(state.inventory.length,133);assert.equal(state.design.placements.length,2);
 await s.close();s=await createService(file);room=await createRoom(s);assert.deepEqual((await room.read(u)).design,state.design);assert.equal((await room.read(v)).inventory.length,0);
 for(const form of Object.values(evolutionChains).flat())assert(accessoryAnchors[form.id],form.id);
 for(const skin of skins){assert(skinAccessoryAnchors[skin.id],skin.id);for(const item of items){const p=accessoryPlacement(skin.character,item.id,skin.id);assert(Number.isFinite(p.ratio)&&p.ratio>0);assert(p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);assert(p.size>0&&p.size<120)}}
 const small=accessoryPlacement('mewtwo','👑','mewtwo-home-shiny'),large=accessoryPlacement('piplup','👑','piplup-01');assert(small.size<large.size/3);assert.notEqual(small.y,accessoryPlacement('mew','👑').y);assert.equal(items.length,30);
 console.log('PASS: 58 calibrated forms/skins, face-relative accessories, room ownership/role guards, 10 concurrent buys charged once, multiple copies, 133-item inventory, custom colors, placements/resize, version conflicts and persistence.');
}finally{await s.close()}
