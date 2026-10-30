import {randomUUID} from 'node:crypto';
import {fail} from './service.mjs';
import {roomItemMap,defaultRoom} from '../src/data/roomItems.js';
export async function createRoom(service){
 const db=service.db,get=(q,...a)=>db.prepare(q).get(...a),all=(q,...a)=>db.prepare(q).all(...a),run=(q,...a)=>db.prepare(q).run(...a);
 await db.exec(`CREATE TABLE IF NOT EXISTS room_inventory(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),item_id TEXT NOT NULL,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS room_inventory_user ON room_inventory(user_id);
 CREATE TABLE IF NOT EXISTS room_designs(user_id TEXT PRIMARY KEY REFERENCES users(id),design TEXT NOT NULL,version INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS room_purchases(user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,item_id TEXT NOT NULL,quantity INTEGER NOT NULL,PRIMARY KEY(user_id,request_key));`);
 async function account(u){service.student(u);return await get("SELECT coins FROM users WHERE id=? AND role='student' AND deleted_at IS NULL",u.id)??fail(401,'로그인이 필요해요.')}
 async function read(u){const user=await account(u),row=await get('SELECT * FROM room_designs WHERE user_id=?',u.id);return {design:row?JSON.parse(row.design):defaultRoom(),version:row?.version??0,inventory:await all('SELECT id,item_id FROM room_inventory WHERE user_id=? ORDER BY created_at,rowid',u.id),balance:user.coins}}
 async function buy(u,b){service.student(u);const item=roomItemMap[b?.itemId],quantity=b?.quantity??1,key=b?.requestKey;
  if(!item||!Number.isSafeInteger(quantity)||quantity<1||quantity>99||typeof key!=='string'||!/^[-\w]{8,100}$/.test(key))fail(400,'아이템과 구매 수량(1~99개)을 확인해 주세요.');
  return db.transaction(async()=>{const user=await account(u),old=await get('SELECT * FROM room_purchases WHERE user_id=? AND request_key=?',u.id,key);
   if(old){if(old.item_id!==item.id||old.quantity!==quantity)fail(409,'구매 요청 내용이 달라졌어요.');return {duplicate:true,...await read(u)}}
   const cost=item.price*quantity;if(user.coins<cost)fail(400,'포인트가 부족해요.');const now=Date.now();
   await db.batch(Array.from({length:quantity},()=>({sql:'INSERT INTO room_inventory VALUES(?,?,?,?)',args:[randomUUID(),u.id,item.id,now]})));
   await run('UPDATE users SET coins=coins-? WHERE id=?',cost,u.id);await run('INSERT INTO room_purchases VALUES(?,?,?,?)',u.id,key,item.id,quantity);
   await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),u.id,-cost,'방꾸미기 구매',item.name+' × '+quantity,'room:'+u.id+':'+key,now);return {duplicate:false,...await read(u)};
  });
 }
 async function save(u,b){service.student(u);return db.transaction(async()=>{
  const state=await read(u),d=b?.design;
  if(!Number.isSafeInteger(b?.version)||b.version!==state.version)fail(409,'다른 화면에서 방이 변경됐어요. 새로 불러온 뒤 다시 꾸며 주세요.');
  if(!d||!/^#[\da-fA-F]{6}$/.test(d.wall)||!/^#[\da-fA-F]{6}$/.test(d.floor)||typeof d.grid!=='boolean'||!Array.isArray(d.placements))fail(400,'방 색상과 배치를 확인해 주세요.');
  const owned=new Set(state.inventory.map(x=>x.id)),used=new Set(),placements=[];
  for(const p of d.placements){if(!p||!owned.has(p.copyId)||used.has(p.copyId))fail(403,'구매한 아이템만 한 개씩 배치할 수 있어요.');
   if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.size)||!Number.isFinite(p.rotation)||p.x<0||p.x>100||p.y<0||p.y>100||p.size<4||p.size>60||p.rotation< -180||p.rotation>180||typeof p.front!=='boolean')fail(400,'배치 위치와 크기를 확인해 주세요.');
   used.add(p.copyId);placements.push({copyId:p.copyId,x:p.x,y:p.y,size:p.size,rotation:p.rotation,front:p.front});
  }
  const design={wall:d.wall,floor:d.floor,grid:d.grid,placements};await run('INSERT INTO room_designs VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET design=excluded.design,version=excluded.version,updated_at=excluded.updated_at',u.id,JSON.stringify(design),state.version+1,Date.now());return read(u);
 })}
 return {read,buy,save};
}
