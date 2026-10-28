import {fail} from './service.mjs';
const limits={cards:8,hidden:10};
export async function createGameRankings(service){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS game_scores(game TEXT NOT NULL,session_id TEXT NOT NULL,user_id TEXT NOT NULL REFERENCES users(id),level INTEGER NOT NULL,duration_ms INTEGER NOT NULL CHECK(duration_ms>0),metric INTEGER NOT NULL,hints INTEGER NOT NULL,completed_at INTEGER NOT NULL,PRIMARY KEY(game,session_id));CREATE INDEX IF NOT EXISTS game_score_level ON game_scores(game,level,duration_ms,user_id);CREATE TABLE IF NOT EXISTS game_score_migrations(game TEXT PRIMARY KEY);`);
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
  const rows=await db.prepare(`WITH personal AS(SELECT g.*,u.login,u.name,u.pet,ROW_NUMBER() OVER(PARTITION BY g.user_id ORDER BY duration_ms,metric,hints,completed_at,session_id) personal_order FROM game_scores g JOIN users u ON u.id=g.user_id WHERE g.game=? AND g.level=? AND u.deleted_at IS NULL AND u.role='student'),ranked AS(SELECT *,ROW_NUMBER() OVER(ORDER BY duration_ms,metric,hints,completed_at,user_id) place,COUNT(*) OVER() players FROM personal WHERE personal_order=1) SELECT * FROM ranked WHERE place<=20 OR user_id=? ORDER BY place`).all(game,level,u.id);
  const entry=x=>{let character='piplup';try{character=JSON.parse(x.pet).character}catch{}return {rank:x.place,login:x.login,nickname:x.name,character,durationMs:x.duration_ms,attempts:x.metric,hints:x.hints,completedAt:x.completed_at,medal:({1:'gold',2:'silver',3:'bronze'})[x.place]??null,isMe:x.user_id===u.id}};
  return {game,level,totalPlayers:rows[0]?.players??0,entries:rows.filter(x=>x.place<=20).map(entry),me:rows.find(x=>x.user_id===u.id)?entry(rows.find(x=>x.user_id===u.id)):null};
 }
 return {record,list};
}
