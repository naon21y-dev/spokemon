import {createGameRankings} from './game-rankings.mjs';
import {randomUUID,randomInt} from 'node:crypto';
import {fail} from './service.mjs';
import {cardLevels} from '../src/data/card-levels.js';
export async function createCardGame(service){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS card_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,level INTEGER NOT NULL,state TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(user_id,request_key));`);
 const rankings=await createGameRankings(service);
 const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
 function view(row,g){const shown=new Set([...g.open,...g.matched]);return {id:row.id,level:row.level,cards:g.deck.map((v,i)=>shown.has(i)?v:null),open:g.open,matched:g.matched,tries:g.tries,done:g.done,elapsedMs:g.done?(g.durationMs??null):Math.max(0,Date.now()-(row.created_at??Date.now())),durationMs:g.durationMs??null,reward:g.done?cardLevels[row.level-1].reward:0};}
 async function start(u,b){
  service.student(u);const level=b?.level,key=b?.requestKey;
  if(!Number.isInteger(level)||level<1||level>cardLevels.length||typeof key!=='string'||!/^[-\w]{8,100}$/.test(key))fail(400,'게임 레벨을 확인해 주세요.');
  return db.transaction(async()=>{
   const old=await db.prepare('SELECT * FROM card_sessions WHERE user_id=? AND request_key=?').get(u.id,key);
   if(old){if(old.level!==level)fail(409,'시작 요청이 바뀌었어요.');return view(old,JSON.parse(old.state))}
   const order=shuffle(Array.from({length:9},(_,i)=>i)),pairs=Array.from({length:cardLevels[level-1].pairs},(_,i)=>order[i%9]);
   const g={deck:shuffle(pairs.flatMap(x=>[x,x])),open:[],matched:[],tries:0,done:false,hideAt:0},row={id:randomUUID(),level,created_at:Date.now()};
   await db.prepare('INSERT INTO card_sessions VALUES(?,?,?,?,?,?)').run(row.id,u.id,key,level,JSON.stringify(g),row.created_at);
   return view(row,g);
  });
 }
 async function flip(u,id,b){
  service.student(u);
  return db.transaction(async()=>{
   const row=await db.prepare('SELECT * FROM card_sessions WHERE id=? AND user_id=?').get(id,u.id);if(!row)fail(404,'내 카드게임을 찾을 수 없어요.');
   if(Date.now()-row.created_at>2*3600000)fail(410,'게임 시간이 만료됐어요. 새 게임을 시작해 주세요.');
   const g=JSON.parse(row.state),i=b?.index,c=cardLevels[row.level-1];
   if(!Number.isInteger(i)||i<0||i>=g.deck.length)fail(400,'카드를 확인해 주세요.');
   if(g.done)return view(row,g);
   if(g.open.length===2&&Date.now()>=g.hideAt)g.open=[];
   if(g.open.length===2||g.open.includes(i)||g.matched.includes(i))return view(row,g);
   g.open.push(i);
   if(g.open.length===2){g.tries++;const [a,z]=g.open;if(g.deck[a]===g.deck[z]){g.matched.push(a,z);g.open=[];g.done=g.matched.length===g.deck.length}else g.hideAt=Date.now()+c.delay;}
   if(g.done){const completedAt=Date.now();g.durationMs=Math.max(1,completedAt-row.created_at);await rankings.record({game:'cards',sessionId:id,userId:u.id,level:row.level,durationMs:g.durationMs,metric:g.tries,hints:0,completedAt});await db.prepare('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)').run(randomUUID(),u.id,c.reward,'카드게임 클리어','LEVEL '+c.id+' · '+c.pairs+'쌍 완성','card-clear:'+id,Date.now());await db.prepare('UPDATE users SET coins=coins+? WHERE id=?').run(c.reward,u.id);}
   await db.prepare('UPDATE card_sessions SET state=? WHERE id=?').run(JSON.stringify(g),id);
   return view(row,g);
  });
 }
 return {start,flip};
}
