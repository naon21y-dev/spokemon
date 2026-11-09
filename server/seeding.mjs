import {randomUUID, randomInt} from 'node:crypto';
import {ensureSloudSchema} from './sloud.mjs';
import {fail} from './service.mjs';
import {seedingQuestions} from './questions/seeding.js';
import {isCorrect,answerText,correctText} from './questions/schema.js';

export const seedingMessage = "열심히 해서 1시드를 노려보세요!!!!\n아 공부 안 하게? 안 하게? 안 하게? 안 하게? 안 하게? 4시드 가게? 4시드? 1시드 안 하게? 1시드 놓치게?";
export const visibleNotices = `SELECT n.* FROM broadcast_notices n LEFT JOIN sloud_posts p ON n.kind='sloud-notice' AND p.id=n.target WHERE (n.kind='seeding-open' AND (SELECT enabled FROM seeding_settings WHERE id=1)=1 AND n.id=(SELECT id FROM broadcast_notices WHERE kind='seeding-open' ORDER BY created_at DESC,rowid DESC LIMIT 1)) OR (n.kind='sloud-notice' AND p.deleted_at IS NULL AND p.id IS NOT NULL AND EXISTS(SELECT 1 FROM users u WHERE u.id=p.author AND u.deleted_at IS NULL))`;
const shuffle = values => {const a=[...values];for(let i=a.length-1;i>0;i--){const j=randomInt(i+1);[a[i],a[j]]=[a[j],a[i]]}return a};
const normalize = value => String(value).trim().toLowerCase().replace(/\s+/g,'').replace(/[‘’“”'"]/g,'').replace(/，/g,',');
const bank = new Map(seedingQuestions.map(q=>[q.id,q]));
export async function createSeeding(service,{clock=Date.now}={}) {
 const db=service.db;
 await ensureSloudSchema(db);
 const get=(s,...a)=>db.prepare(s).get(...a),run=(s,...a)=>db.prepare(s).run(...a);
 await db.exec(`CREATE TABLE IF NOT EXISTS seeding_settings(id INTEGER PRIMARY KEY CHECK(id=1),enabled INTEGER NOT NULL CHECK(enabled IN (0,1)));
 CREATE TABLE IF NOT EXISTS broadcast_notices(id TEXT PRIMARY KEY,kind TEXT NOT NULL,title TEXT NOT NULL,detail TEXT NOT NULL,target TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS seeding_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),questions TEXT NOT NULL,answers TEXT NOT NULL DEFAULT '{}',revision INTEGER NOT NULL DEFAULT 0,result TEXT,created_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS seeding_user ON seeding_sessions(user_id,created_at);`);
 await db.transaction(async()=>{
  if(!await get('SELECT 1 FROM seeding_settings WHERE id=1')){
   await run('INSERT INTO seeding_settings VALUES(1,1)');
   await run('INSERT INTO broadcast_notices VALUES(?,?,?,?,?,?)',randomUUID(),'seeding-open',"GT's seeding OPEN!",seedingMessage,null,clock());
  }
 });
 async function settings(u,b){
  if(b!==undefined){service.admin(u);if(typeof b.enabled!=='boolean')fail(400,'공개 여부를 확인해 주세요.');
   await db.transaction(async()=>{const old=await get('SELECT enabled FROM seeding_settings WHERE id=1');if(Boolean(old.enabled)===b.enabled)return;
    await run('UPDATE seeding_settings SET enabled=? WHERE id=1',Number(b.enabled));
    if(b.enabled)await run('INSERT INTO broadcast_notices VALUES(?,?,?,?,?,?)',randomUUID(),'seeding-open',"GT's seeding OPEN!",seedingMessage,null,clock());
   });
  }
  return {enabled:!!(await get('SELECT enabled FROM seeding_settings WHERE id=1')).enabled,questionCount:30,reward:500};
 }
 async function active(u,id){service.student(u);if(!(await settings(u)).enabled)fail(403,"GT's seeding은 지금 쉬고 있어요.");const row=await get('SELECT * FROM seeding_sessions WHERE id=? AND user_id=?',id,u.id);if(!row)fail(404,'내 풀이를 찾을 수 없어요.');return row}
 function view(row){if(!row)return null;const result=row.result?JSON.parse(row.result):null;return {id:row.id,revision:row.revision,answers:JSON.parse(row.answers),result,questions:JSON.parse(row.questions).map(stored=>{const q=bank.get(stored.id);return {id:q.id,prompt:q.prompt,code:q.code??'',type:q.type,...(stored.options?{options:stored.options}:{}),...(result?{correctAnswer:correctText(q),explanation:q.explanation}: {})}})}}
 async function read(u){service.student(u);const config=await settings(u);if(!config.enabled)return {...config,session:null};return {...config,session:view(await get('SELECT * FROM seeding_sessions WHERE user_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1',u.id))}}
 async function start(u){service.student(u);return db.transaction(async()=>{if(!(await settings(u)).enabled)fail(403,"GT's seeding은 지금 쉬고 있어요.");const old=await get('SELECT * FROM seeding_sessions WHERE user_id=? AND result IS NULL ORDER BY created_at DESC,rowid DESC LIMIT 1',u.id);if(old)return view(old);
  const questions=shuffle(seedingQuestions).slice(0,30).map(q=>({id:q.id,...(q.options?{options:shuffle(q.options)}:{})})),id=randomUUID();
  await run('INSERT INTO seeding_sessions(id,user_id,questions,created_at) VALUES(?,?,?,?)',id,u.id,JSON.stringify(questions),clock());return view(await active(u,id));})}
 function validate(row,answers,complete){if(!answers||typeof answers!=='object'||Array.isArray(answers))fail(400,'답안을 확인해 주세요.');const questions=JSON.parse(row.questions),ids=new Set(questions.map(q=>q.id));if(Object.keys(answers).some(id=>!ids.has(id)))fail(400,'다른 세트의 답안이 있어요.');const clean={};for(const stored of questions){const q=bank.get(stored.id),answer=answers[q.id]??'';if(typeof answer!=='string'||answer.length>200||q.options&&answer&&!q.options.some(o=>o.id===answer))fail(400,'답안을 확인해 주세요.');if(complete&&!answer.trim())fail(400,'30문제에 모두 답한 뒤 제출해 주세요.');if(answer)clean[q.id]=answer}return clean}
 async function draft(u,id,b){return db.transaction(async()=>{const row=await active(u,id);if(row.result)return view(row);if(b.revision!==row.revision)fail(409,'다른 화면에서 답안이 변경됐어요. 새로고침 후 확인해 주세요.');const answers=validate(row,b.answers,false);await run('UPDATE seeding_sessions SET answers=?,revision=revision+1 WHERE id=?',JSON.stringify(answers),id);return view(await active(u,id))})}
 async function submit(u,id,b){return db.transaction(async()=>{const row=await active(u,id);if(row.result)return view(row);if(b.revision!==row.revision)fail(409,'다른 화면에서 답안이 변경됐어요. 새로고침 후 확인해 주세요.');const answers=validate(row,b.answers,true),items=JSON.parse(row.questions).map(({id})=>{const q=bank.get(id);return {id,correct:isCorrect({...q,acceptedAnswers:q.acceptedAnswers.map(normalize)},normalize(answers[id])),answerText:answerText(q,answers[id])}}),correct=items.filter(a=>a.correct).length;
  const result={total:30,correct,score:Math.round(correct/30*100),coins:500,finishedAt:clock(),items};
  const account=await get('SELECT coins FROM users WHERE id=? AND deleted_at IS NULL',u.id);if(!account)fail(401,'로그인이 필요해요.');if(!Number.isSafeInteger(account.coins+500))fail(400,'포인트 한도를 초과합니다.');
  await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',randomUUID(),u.id,500,"GT's seeding 완료",'30문제 일괄 제출 보상','seeding:'+id,clock());
  await run('UPDATE users SET coins=coins+500 WHERE id=?',u.id);
  await run('UPDATE seeding_sessions SET answers=?,revision=revision+1,result=? WHERE id=?',JSON.stringify(answers),JSON.stringify(result),id);
  return view(await active(u,id));})}
 return {settings,active,read,start,draft,submit};
}
