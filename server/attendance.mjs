import {randomUUID} from 'node:crypto';
import {fail,kstDay} from './service.mjs';
export async function createAttendance(service,{clock}){
 const db=service.db,get=(sql,...a)=>db.prepare(sql).get(...a),run=(sql,...a)=>db.prepare(sql).run(...a);
 await db.exec(`CREATE TABLE IF NOT EXISTS attendance_progress(user_id TEXT PRIMARY KEY REFERENCES users(id),last_day TEXT NOT NULL,streak INTEGER NOT NULL CHECK(streak BETWEEN 1 AND 7),cycle INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS attendance_days(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,day_number INTEGER NOT NULL,cycle INTEGER NOT NULL,amount INTEGER NOT NULL,bonus INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,day));`);
 async function checkIn(u){service.student(u);return db.transaction(async()=>{
  const account=await get("SELECT coins FROM users WHERE id=? AND role='student' AND deleted_at IS NULL",u.id);if(!account)fail(401,'로그인이 필요해요.');
  const now=clock(),day=kstDay(now),existing=await get('SELECT * FROM attendance_days WHERE user_id=? AND day=?',u.id,day);
  let entry=existing;
  if(!entry){
   const old=await get('SELECT * FROM attendance_progress WHERE user_id=?',u.id),yesterday=kstDay(now-86400000),continuous=old?.last_day===yesterday&&old.streak<7;
   const number=continuous?old.streak+1:1,cycle=continuous?old.cycle:(old?.cycle??0)+1,bonus=number===7?100:0,amount=5+bonus;
   if(!Number.isSafeInteger(account.coins+amount))fail(400,'포인트 한도를 초과합니다.');
   await run('INSERT INTO attendance_days VALUES(?,?,?,?,?,?,?)',u.id,day,number,cycle,amount,bonus,now);
   await run('INSERT INTO attendance_progress VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET last_day=excluded.last_day,streak=excluded.streak,cycle=excluded.cycle',u.id,day,number,cycle);
   await run('UPDATE users SET coins=coins+? WHERE id=?',amount,u.id);
   await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),u.id,amount,'연속 출석',`${number}일차 출석 +5 P`+(bonus?' · 7일 완주 +100 P':''),'attendance:'+u.id+':'+day,now);
   entry={day_number:number,cycle,amount,bonus};
  }
  const days=await db.prepare('SELECT day_number,day FROM attendance_days WHERE user_id=? AND cycle=? ORDER BY day_number').all(u.id,entry.cycle);
  return {day,streak:entry.day_number,cycle:entry.cycle,days,awarded:existing?0:entry.amount,bonus:entry.bonus,balance:account.coins+(existing?0:entry.amount)};
 })}
 return {checkIn};
}
