import {createGameRankings} from './game-rankings.mjs';
import {randomUUID,randomInt} from 'node:crypto';
import {fail} from './service.mjs';
import {hiddenLevels} from '../src/data/hidden-levels.js';
const emojis=['🍎','🍓','🍋','🍒','🥕','🍄','🌻','🌷','🍀','🌙','⭐','🦋','🐞','🐝','🐟','🐚','🎀','💎','🔑','🎈','🧩','🍬','🪶','🧸','🎲','🌈','🧁','⚽'];
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
export async function createHiddenGame(service){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS hidden_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,level INTEGER NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,request_key));`);
 const rankings=await createGameRankings(service);
 const view=(r,g)=>({id:r.id,level:r.level,objects:g.objects,found:g.found,misses:g.misses,hintsLeft:3-g.hints.length,hint:g.hints.at(-1)??null,done:g.done,elapsedMs:g.done?(g.durationMs??null):Math.max(0,Date.now()-(r.created_at??Date.now())),durationMs:g.durationMs??null,reward:g.done?3:0});
 async function start(u,b){service.student(u);const level=b?.level,key=b?.requestKey;if(!Number.isInteger(level)||level<1||level>10||typeof key!=='string'||!/^[-\w]{8,100}$/.test(key))fail(400,'1~10단계를 선택해 주세요.');return db.transaction(async()=>{
  const old=await db.prepare('SELECT * FROM hidden_sessions WHERE user_id=? AND request_key=?').get(u.id,key);if(old){if(old.level!==level)fail(409,'게임 시작 요청을 확인해 주세요.');return view(old,JSON.parse(old.state))}
  const config=hiddenLevels[level-1],pool=shuffle([...emojis]),cells=shuffle(Array.from({length:49},(_,i)=>i));
  const objects=Array.from({length:config.targets+config.decoys},(_,i)=>({id:randomUUID(),emoji:i<10?pool[i]:pool[10+(i-10)%(pool.length-10)],target:i<10,x:((cells[i]%7+.5)/7)*100+(randomInt(21)-10)/10,y:((Math.floor(cells[i]/7)+.5)/7)*100+(randomInt(21)-10)/10,rotation:randomInt(41)-20}));
  const row={id:randomUUID(),level,created_at:Date.now()},g={objects:shuffle(objects),found:[],misses:0,hints:[],done:false};await db.prepare('INSERT INTO hidden_sessions VALUES(?,?,?,?,?,?)').run(row.id,u.id,key,level,JSON.stringify(g),row.created_at);return view(row,g);
 });}
 async function act(u,id,b){service.student(u);return db.transaction(async()=>{
  const row=await db.prepare('SELECT * FROM hidden_sessions WHERE id=? AND user_id=?').get(id,u.id);if(!row)fail(404,'내 숨은그림 게임을 찾을 수 없어요.');if(Date.now()-row.created_at>2*3600000)fail(410,'게임 시간이 만료됐어요. 다시 시작해 주세요.');const g=JSON.parse(row.state);if(g.done)return view(row,g);
  if(b?.action==='hint'){
   if(g.hints.length>=3)fail(400,'힌트 3번을 모두 사용했어요.');const target=g.objects.find(o=>o.target&&!g.found.includes(o.id)&&!g.hints.includes(o.id))??g.objects.find(o=>o.target&&!g.found.includes(o.id));if(target)g.hints.push(target.id);
  }else if(b?.action==='find'){
   const item=g.objects.find(o=>o.id===b.objectId);if(!item)fail(400,'그림을 확인해 주세요.');if(item.target){if(!g.found.includes(item.id))g.found.push(item.id)}else g.misses++;
  }else if(b?.action==='miss')g.misses++;else fail(400,'행동을 확인해 주세요.');
  g.done=g.found.length===10;
  if(g.done){const completedAt=Date.now();g.durationMs=Math.max(1,completedAt-row.created_at);await rankings.record({game:'hidden',sessionId:id,userId:u.id,level:row.level,durationMs:g.durationMs,metric:g.misses,hints:g.hints.length,completedAt});await db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(),u.id,3,'숨은그림 클리어','LEVEL '+row.level+' · 이모지 10개 완성','hidden-clear:'+id,Date.now());await db.prepare('UPDATE users SET coins=coins+3 WHERE id=?').run(u.id);}
  await db.prepare('UPDATE hidden_sessions SET state=? WHERE id=?').run(JSON.stringify(g),id);return view(row,g);
 });}
 return {start,act};
}
