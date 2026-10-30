import {randomUUID} from 'node:crypto';
import {fail,unitOf} from './service.mjs';
const rewards=[5,10,15,20,30,40,50,65,80,100];
const goals=[1,2,3,5,8,10,12,15,20];
export async function createQuests(service,{clock,content,releases,loadQuestions,questionMap}){
 const db=service.db,get=(s,...a)=>db.prepare(s).get(...a),all=(s,...a)=>db.prepare(s).all(...a),run=(s,...a)=>db.prepare(s).run(...a);
 await db.exec(`CREATE TABLE IF NOT EXISTS quest_evidence(user_id TEXT NOT NULL REFERENCES users(id),root_id TEXT NOT NULL,correct INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(user_id,root_id));
 CREATE TABLE IF NOT EXISTS quest_backfills(user_id TEXT PRIMARY KEY REFERENCES users(id));
 CREATE TABLE IF NOT EXISTS quest_bulk_alerts(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL,count INTEGER NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS quest_claims(user_id TEXT NOT NULL REFERENCES users(id),quest_id TEXT NOT NULL,amount INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,quest_id));`);
 async function record(u,q,correct){if(q.source==='student')return;await run('INSERT INTO quest_evidence VALUES(?,?,?) ON CONFLICT(user_id,root_id) DO UPDATE SET correct=MAX(correct,excluded.correct)',u.id,q.originalId??q.id,correct?1:0)}
 async function backfill(u){
  if(await get('SELECT 1 FROM quest_backfills WHERE user_id=?',u.id))return;
  const history=new Map();
  for(const row of await all('SELECT answers FROM quiz_sessions WHERE user_id=?',u.id)){
   let answers;try{answers=JSON.parse(row.answers)}catch{continue}
   await loadQuestions(Object.keys(answers));
   for(const [id,a] of Object.entries(answers)){const q=questionMap[id];if(!q||q.source==='student')continue;const root=q.originalId??q.id;history.set(root,Math.max(history.get(root)??0,a.correct===true?1:0))}
  }
  const rows=[...history];for(let i=0;i<rows.length;i+=200)await db.batch(rows.slice(i,i+200).map(([root,correct])=>({sql:'INSERT INTO quest_evidence VALUES(?,?,?) ON CONFLICT(user_id,root_id) DO UPDATE SET correct=MAX(correct,excluded.correct)',args:[u.id,root,correct]})));
  await run('INSERT OR IGNORE INTO quest_backfills VALUES(?)',u.id);
 }
 async function build(u){
  service.student(u);
  const account=await get("SELECT * FROM users WHERE id=? AND role='student' AND deleted_at IS NULL",u.id);
  if(!account)fail(401,'로그인이 필요해요.');
  const {subjects,questions}=await content(),open=await releases(account);
  await backfill(account);
  const evidence=new Map((await all('SELECT root_id,correct FROM quest_evidence WHERE user_id=?',u.id)).map(x=>[x.root_id,x.correct]));
  const claimed=new Map((await all('SELECT quest_id,amount FROM quest_claims WHERE user_id=?',u.id)).map(x=>[x.quest_id,x.amount]));
  const units=subjects.flatMap(s=>(s.units??[]).filter(unit=>unit.number>0).map(unit=>{
   const roots=[...new Set(questions.filter(q=>q.subject===s.id&&unitOf(q)===unit.number&&q.source!=='student').map(q=>q.originalId??q.id))];
   const correct=roots.filter(id=>evidence.get(id)===1).length,attempted=roots.filter(id=>evidence.has(id)).length,locked=!(open[s.id]??[]).includes(unit.number)||!roots.length;
   return {subject:s.id,subjectName:s.name,unit:unit.number,title:unit.title,total:roots.length,correct,locked,quests:rewards.map((reward,i)=>{
    const id=JSON.stringify([s.id,unit.number,i+1]),target=i===0?1:Math.max(1,Math.ceil(Math.min(20,roots.length)*goals[i-1]/20)),progress=i===0?attempted:correct;
    return {id,tier:i+1,title:i===0?'첫 퀴즈에 도전하기':`서로 다른 문제 ${target}개 맞히기`,target,progress:Math.min(target,progress),reward:claimed.get(id)??reward,claimed:claimed.has(id),ready:!locked&&progress>=target&&!claimed.has(id)};
   })};
  }));
  return {units,balance:account.coins,ready:units.reduce((n,u)=>n+u.quests.filter(q=>q.ready).length,0)};
 }
 async function list(u){return db.transaction(()=>build(u))}
 async function claim(u,id){return db.transaction(async()=>{
  const book=await build(u),unit=book.units.find(u=>u.quests.some(q=>q.id===id)),quest=unit?.quests.find(q=>q.id===id);
  if(!quest)fail(404,'퀘스트를 찾을 수 없어요.');
  if(unit.locked)fail(403,'아직 배우지 않은 단원입니다');
  if(quest.claimed)return {awarded:0,duplicate:true};
  if(!quest.ready)fail(409,'퀘스트 목표를 먼저 달성해 주세요.');
  if(!Number.isSafeInteger(book.balance+quest.reward))fail(400,'포인트 한도를 초과합니다.');
  const now=clock();
  await run('INSERT INTO quest_claims VALUES(?,?,?,?)',u.id,id,quest.reward,now);
  await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),u.id,quest.reward,'퀘스트 보상',`${unit.subjectName} · ${unit.title} · ${quest.tier}단계 · ${quest.title}`,'quest:'+u.id+':'+id,now);
  await run('UPDATE users SET coins=coins+? WHERE id=?',quest.reward,u.id);
  return {awarded:quest.reward,duplicate:false};
 })}
 async function claimAll(u){return db.transaction(async()=>{
  const book=await build(u),available=book.units.flatMap(unit=>unit.quests.filter(q=>q.ready&&!unit.locked).map(quest=>({unit,quest}))),awarded=available.reduce((n,{quest})=>n+quest.reward,0);
  if(!Number.isSafeInteger(book.balance+awarded))fail(400,'포인트 한도를 초과합니다.');
  const now=clock(),statements=available.flatMap(({unit,quest})=>[
   {sql:'INSERT INTO quest_claims VALUES(?,?,?,?)',args:[u.id,quest.id,quest.reward,now]},
   {sql:'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',args:[randomUUID(),u.id,quest.reward,'퀘스트 일괄 보상',`${unit.subjectName} · ${unit.title} · ${quest.tier}단계 · ${quest.title}`,'quest:'+u.id+':'+quest.id,now]}
  ]);
  for(let i=0;i<statements.length;i+=100)await db.batch(statements.slice(i,i+100));
  if(awarded){await run('UPDATE users SET coins=coins+? WHERE id=?',awarded,u.id);await run('INSERT INTO quest_bulk_alerts VALUES(?,?,?,?,?)',randomUUID(),u.id,awarded,available.length,now);}
  return {awarded,count:available.length,duplicate:available.length===0};
 })}
 return {list,claim,claimAll,record};
}
