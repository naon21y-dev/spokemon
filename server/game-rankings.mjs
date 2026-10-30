import {evolutionStage,evolvedCharacter} from '../src/data/evolutions.js';
import {fail} from './service.mjs';
const limits={cards:8,hidden:10};
export async function createGameRankings(service){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS game_scores(game TEXT NOT NULL,session_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),level INTEGER NOT NULL,duration_ms INTEGER NOT NULL CHECK(duration_ms>0),metric INTEGER NOT NULL,hints INTEGER NOT NULL,completed_at INTEGER NOT NULL,PRIMARY KEY(game,session_id));CREATE INDEX IF NOT EXISTS game_score_level ON game_scores(game,level,duration_ms,user_id);CREATE TABLE IF NOT EXISTS game_score_migrations(game TEXT PRIMARY KEY);CREATE TABLE IF NOT EXISTS game_score_removals(game TEXT NOT NULL,session_id TEXT NOT NULL,admin_id TEXT NOT NULL REFERENCES users(id),removed_at INTEGER NOT NULL,PRIMARY KEY(game,session_id));CREATE TABLE IF NOT EXISTS game_score_actions(id INTEGER PRIMARY KEY,game TEXT NOT NULL,session_id TEXT,admin_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,detail TEXT NOT NULL,created_at INTEGER NOT NULL);`);
 // Restore historical timings only from the server's successful reward ledger.
 await db.transaction(async()=>{
  for(const [game,table,prefix,metric] of [['cards','card_sessions','card-clear:','tries'],['hidden','hidden_sessions','hidden-clear:','misses']]){
   if(await db.prepare('SELECT 1 FROM game_score_migrations WHERE game=?').get(game))continue;
   if(!await db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table))continue;
   await db.prepare(`INSERT OR IGNORE INTO game_scores SELECT ?,s.id,s.user_id,s.level,MAX(1,l.created_at-s.created_at),COALESCE(json_extract(s.state,'$.${metric}'),0),${game==='hidden'?"COALESCE(json_array_length(json_extract(s.state,'$.hints')),0)":'0'},l.created_at FROM ${table} s JOIN ledger l ON l.unique_key=?||s.id AND l.user_id=s.user_id WHERE json_valid(s.state) AND json_extract(s.state,'$.done')=1 AND s.level BETWEEN 1 AND ?`).run(game,prefix,limits[game]);
   await db.prepare('INSERT OR IGNORE INTO game_score_migrations VALUES(?)').run(game);
  }
 });
 function validate(game,level){if(!Object.hasOwn(limits,game)||!Number.isInteger(level)||level<1||level>limits[game])fail(400,'게임과 단계를 확인해 주세요.');}
 async function record({game,sessionId,userId,level,durationMs,metric=0,hints=0,completedAt}){
  validate(game,level);if(!Number.isSafeInteger(durationMs)||durationMs<1||!Number.isSafeInteger(completedAt))fail(400,'서버 게임 기록을 확인해 주세요.');
  await db.prepare('INSERT OR IGNORE INTO game_scores VALUES(?,?,?,?,?,?,?,?)').run(game,sessionId,userId,level,durationMs,metric,hints,completedAt);
 }
 async function list(u,game,level){
  validate(game,level);
  const rows=await db.prepare(`WITH personal AS(SELECT g.*,u.login,u.name,u.pet,ROW_NUMBER() OVER(PARTITION BY g.user_id ORDER BY duration_ms,metric,hints,completed_at,session_id) personal_order FROM game_scores g JOIN users u ON u.id=g.user_id WHERE g.game=? AND g.level=? AND NOT EXISTS(SELECT 1 FROM game_score_removals removed WHERE removed.game=g.game AND removed.session_id=g.session_id) AND u.deleted_at IS NULL AND u.role='student'),ranked AS(SELECT *,ROW_NUMBER() OVER(ORDER BY duration_ms,metric,hints,completed_at,user_id) place,COUNT(*) OVER() players FROM personal WHERE personal_order=1) SELECT * FROM ranked WHERE place<=20 OR user_id=? ORDER BY place`).all(game,level,u.id);
  const entry=x=>{let character='piplup',stage=1,formId='';try{const pet=JSON.parse(x.pet);character=pet.character;stage=evolutionStage(pet);formId=character==='diglett'&&stage===2?evolvedCharacter(pet).formId:''}catch{}return {rank:x.place,login:x.login,nickname:x.name,character,stage,...(formId?{formId}:{}),durationMs:x.duration_ms,attempts:x.metric,hints:x.hints,completedAt:x.completed_at,medal:({1:'gold',2:'silver',3:'bronze'})[x.place]??null,isMe:x.user_id===u.id}};
  return {game,level,totalPlayers:rows[0]?.players??0,entries:rows.filter(x=>x.place<=20).map(entry),me:rows.find(x=>x.user_id===u.id)?entry(rows.find(x=>x.user_id===u.id)):null};
 }
 function adminFilters(filters={}){
  const game=filters.game,level=Number(filters.level),search=String(filters.search??'').trim(),status=filters.status??'active';validate(game,level);if(search.length>100||!['active','deleted'].includes(status))fail(400,'검색 조건을 확인해 주세요.');
  const where="g.game=? AND g.level=? AND u.role='student'"+(search?" AND (u.name LIKE ? OR u.login LIKE ?)":"")+(status==='deleted'?" AND r.session_id IS NOT NULL":" AND r.session_id IS NULL"),args=[game,level,...(search?['%'+search+'%','%'+search+'%']:[])];return {game,level,search,status,where,args};
 }
 const adminJoin='FROM game_scores g JOIN users u ON u.id=g.user_id LEFT JOIN classes c ON c.id=u.class_id LEFT JOIN game_score_removals r ON r.game=g.game AND r.session_id=g.session_id';
 async function adminList(u,filters={}){service.admin(u);const f=adminFilters(filters),total=(await db.prepare('SELECT count(*) n '+adminJoin+' WHERE '+f.where).get(...f.args)).n,requested=Number(filters.page??1);if(!Number.isInteger(requested)||requested<1)fail(400,'페이지를 확인해 주세요.');const pages=Math.max(1,Math.ceil(total/50)),page=Math.min(requested,pages);
  const rows=await db.prepare('SELECT g.*,u.name,u.login,c.name class_name,r.removed_at '+adminJoin+' WHERE '+f.where+' ORDER BY g.duration_ms,g.completed_at,g.session_id LIMIT 50 OFFSET ?').all(...f.args,(page-1)*50);
  return {total,page,pages,items:rows.map(x=>({game:x.game,sessionId:x.session_id,userId:x.user_id,nickname:x.name,login:x.login,className:x.class_name??'미배정',level:x.level,durationMs:x.duration_ms,attempts:x.metric,hints:x.hints,completedAt:x.completed_at,deletedAt:x.removed_at??null}))};
 }
 async function adminRemove(u,game,id,restore=false){service.admin(u);validate(game,1);if(typeof id!=='string'||!/^[-\w]{8,100}$/.test(id))fail(400,'게임 기록을 확인해 주세요.');return db.transaction(async()=>{
  if(!await db.prepare('SELECT 1 FROM game_scores WHERE game=? AND session_id=?').get(game,id))fail(404,'게임 기록을 찾을 수 없어요.');const now=Date.now();
  const result=restore?await db.prepare('DELETE FROM game_score_removals WHERE game=? AND session_id=?').run(game,id):await db.prepare('INSERT OR IGNORE INTO game_score_removals VALUES(?,?,?,?)').run(game,id,u.id,now);
  if(result.changes)await db.prepare('INSERT INTO game_score_actions(game,session_id,admin_id,action,detail,created_at) VALUES(?,?,?,?,?,?)').run(game,id,u.id,restore?'restore':'remove','',now);return {changed:result.changes};
 })}
 async function adminClear(u,body){service.admin(u);if(body?.confirm!=='삭제')fail(400,'삭제 확인 문구를 입력해 주세요.');const f=adminFilters({...body,status:'active'});return db.transaction(async()=>{
  const now=Date.now(),result=await db.prepare('INSERT OR IGNORE INTO game_score_removals(game,session_id,admin_id,removed_at) SELECT g.game,g.session_id,?,? '+adminJoin+' WHERE '+f.where).run(u.id,now,...f.args);
  if(result.changes)await db.prepare('INSERT INTO game_score_actions(game,session_id,admin_id,action,detail,created_at) VALUES(?,NULL,?,?,?,?)').run(f.game,u.id,'batch-remove',JSON.stringify({level:f.level,search:f.search,count:result.changes}),now);return {changed:result.changes};
 })}
 return {record,list,adminList,adminRemove,adminClear};
}
