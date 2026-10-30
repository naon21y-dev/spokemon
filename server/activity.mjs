import {fail} from './service.mjs';
export async function createActivity(service){
 const db=service.db;
 await db.exec(`CREATE TABLE IF NOT EXISTS activity_meta(key TEXT PRIMARY KEY,value INTEGER NOT NULL);CREATE TABLE IF NOT EXISTS activity_receipts(user_id TEXT NOT NULL REFERENCES users(id),event_id TEXT NOT NULL,PRIMARY KEY(user_id,event_id));INSERT OR IGNORE INTO activity_meta SELECT 'ledger_baseline',COALESCE(MAX(rowid),0) FROM ledger;`);
 async function list(u){
  service.student(u);
  const requests=await db.prepare(`SELECT f.sender,u.login,u.name FROM friendships f JOIN users u ON u.id=f.sender WHERE f.recipient=? AND f.accepted=0 AND u.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM activity_receipts r WHERE r.user_id=? AND r.event_id='friend:'||f.sender) ORDER BY u.login LIMIT 30`).all(u.id,u.id);
  const credits=await db.prepare(`SELECT l.id,l.amount,l.kind,l.detail,l.created_at FROM ledger l WHERE l.user_id=? AND l.kind!='연속 출석' AND l.amount>0 AND l.rowid>(SELECT value FROM activity_meta WHERE key='ledger_baseline') AND NOT EXISTS(SELECT 1 FROM activity_receipts r WHERE r.user_id=? AND r.event_id='points:'||l.id) ORDER BY l.created_at,l.rowid LIMIT 50`).all(u.id,u.id);
  const account=await db.prepare('SELECT coins FROM users WHERE id=? AND deleted_at IS NULL').get(u.id);
  return {balance:account?.coins??0,events:[...requests.map(x=>({id:'friend:'+x.sender,kind:'friend-request',senderId:x.sender,login:x.login,name:x.name})),...credits.map(x=>({id:'points:'+x.id,kind:'points',amount:x.amount,reason:x.kind,detail:x.detail,at:x.created_at}))]};
 }
 async function acknowledge(u,body){
  service.student(u);
  if(!Array.isArray(body?.ids)||body.ids.length>80||body.ids.some(x=>typeof x!=='string'||x.length>150))fail(400,'알림을 확인해 주세요.');
  return db.transaction(async()=>{
   for(const id of new Set(body.ids)){
    const [kind,...rest]=id.split(':'),key=rest.join(':');
    const owned=kind==='points'?await db.prepare('SELECT 1 FROM ledger WHERE id=? AND user_id=? AND amount>0').get(key,u.id):kind==='friend'?await db.prepare('SELECT 1 FROM friendships WHERE sender=? AND recipient=?').get(key,u.id):null;
    if(owned)await db.prepare('INSERT OR IGNORE INTO activity_receipts VALUES(?,?)').run(u.id,id);
   }
   return {ok:true};
  });
 }
 return {list,acknowledge};
}
