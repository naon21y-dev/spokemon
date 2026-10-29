import { randomUUID } from 'node:crypto';
import { subjects } from './questions/index.js';
import { unitTitle } from '../src/data/curriculum.js';
import { fail } from './service.mjs';
export async function createCurriculum(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS curriculum_subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,icon TEXT NOT NULL,description TEXT NOT NULL,source TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS curriculum_units(subject TEXT NOT NULL REFERENCES curriculum_subjects(id),number INTEGER NOT NULL,title TEXT NOT NULL COLLATE NOCASE,PRIMARY KEY(subject,number),UNIQUE(subject,title));`);
  await db.exec('CREATE TABLE IF NOT EXISTS curriculum_archives(subject TEXT PRIMARY KEY REFERENCES curriculum_subjects(id),archived_at INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS curriculum_question_locations(question_id TEXT PRIMARY KEY,subject TEXT NOT NULL,unit INTEGER NOT NULL)');
  const seed = [];
  for (const s of subjects) {
    seed.push({
      sql: 'INSERT OR IGNORE INTO curriculum_subjects VALUES(?,?,?,?,?)',
      args: [s.id, s.name, s.icon, s.description, s.source ?? '관리자 공식']
    });
    for (let i = 1; i <= 5; i++) seed.push({
      sql: 'INSERT OR IGNORE INTO curriculum_units VALUES(?,?,?)',
      args: [s.id, i, unitTitle(s.id, i)]
    });
  }
  await db.batch(seed);
  async function list(includeDeleted=false) {
    const [subjects, units] = await Promise.all([db.prepare('SELECT s.*,EXISTS(SELECT 1 FROM curriculum_archives a WHERE a.subject=s.id) archived FROM curriculum_subjects s ORDER BY s.rowid').all(), db.prepare('SELECT * FROM curriculum_units ORDER BY number').all()]);
    return subjects.filter(s=>includeDeleted||!s.archived).map(s => ({
      ...s,
      units: units.filter(u => u.subject === s.id)
    }));
  }
  async function manage(u,b,questions=[]){
    if(u.role!=='admin')fail(403,'관리자만 과목을 관리할 수 있어요.');
    return db.transaction(async()=>{
      const source=await db.prepare('SELECT * FROM curriculum_subjects WHERE id=?').get(b.subject);
      if(!source)fail(404,'과목을 찾을 수 없어요.');
      if(b.confirmName!==source.name)fail(400,'확인할 과목 이름을 정확히 입력해 주세요.');
      if(b.action==='delete'){
        await db.prepare('INSERT OR IGNORE INTO curriculum_archives VALUES(?,?)').run(source.id,Date.now());
      }else if(b.action==='restore'){
        await db.prepare('DELETE FROM curriculum_archives WHERE subject=?').run(source.id);
      }else if(b.action==='move'){
        const target=await db.prepare('SELECT * FROM curriculum_subjects WHERE id=? AND id NOT IN(SELECT subject FROM curriculum_archives)').get(b.target);
        if(!target||target.id===source.id)fail(400,'서로 다른 활성 과목을 선택하세요.');
        if(await db.prepare('SELECT 1 FROM curriculum_archives WHERE subject=?').get(source.id))fail(409,'삭제한 과목은 먼저 복구하세요.');
        const sourceUnits=await db.prepare('SELECT * FROM curriculum_units WHERE subject=? ORDER BY number').all(source.id);
        const map=new Map([[0,0]]);
        let next=(await db.prepare('SELECT COALESCE(MAX(number),0) n FROM curriculum_units WHERE subject=?').get(target.id)).n;
        if(next+sourceUnits.length>200)fail(400,'이동하면 과목당 200개 단원 한도를 넘어요.');
        for(const unit of sourceUnits){
          const same=await db.prepare('SELECT number FROM curriculum_units WHERE subject=? AND title=? COLLATE NOCASE').get(target.id,unit.title);
          const number=same?.number??++next;map.set(unit.number,number);
          if(!same)await db.prepare('INSERT INTO curriculum_units VALUES(?,?,?)').run(target.id,number,unit.title);
        }
        const locationWrites=questions.filter(q=>!q.postId&&q.subject===source.id).map(q=>({sql:'INSERT INTO curriculum_question_locations VALUES(?,?,?) ON CONFLICT(question_id) DO UPDATE SET subject=excluded.subject,unit=excluded.unit',args:[q.id,target.id,map.get(q.unit??Math.floor((Number(q.id.split('-').at(-1))-1)/(q.type==='multiple'?12:8))+1)??0]}));
        for(let i=0;i<locationWrites.length;i+=200)await db.batch(locationWrites.slice(i,i+200));
        const rows=await db.prepare('SELECT v.question_id,v.content FROM workshop_versions v JOIN workshop_posts p ON p.id=v.post_id WHERE p.subject=?').all(source.id);
        const versionWrites=rows.map(row=>{const q=JSON.parse(row.content);q.subject=target.id;q.unit=map.get(q.unit)??0;return {sql:'UPDATE workshop_versions SET content=? WHERE question_id=?',args:[JSON.stringify(q),row.question_id]}});
        for(let i=0;i<versionWrites.length;i+=200)await db.batch(versionWrites.slice(i,i+200));
        for(const [old,number] of map)await db.prepare('UPDATE workshop_posts SET subject=?,unit=? WHERE subject=? AND unit=?').run(target.id,number,source.id,old);
        for(const row of await db.prepare('SELECT * FROM release_selections WHERE subject=?').all(source.id)){
          const old=await db.prepare('SELECT units FROM release_selections WHERE class_id=? AND subject=?').get(row.class_id,target.id);
          const units=[...new Set([...JSON.parse(old?.units??'[]'),...JSON.parse(row.units).map(n=>map.get(n)).filter(n=>n>0)])].sort((a,b)=>a-b);
          await db.prepare('INSERT INTO release_selections VALUES(?,?,?) ON CONFLICT(class_id,subject) DO UPDATE SET units=excluded.units').run(row.class_id,target.id,JSON.stringify(units));
        }
        for(const c of await db.prepare('SELECT * FROM quest_claims').all()){
          const [subject,unit,tier]=JSON.parse(c.quest_id);if(subject!==source.id||!map.has(unit))continue;
          await db.prepare('INSERT OR IGNORE INTO quest_claims VALUES(?,?,?,?)').run(c.user_id,JSON.stringify([target.id,map.get(unit),tier]),c.amount,c.created_at);
        }
        await db.prepare('INSERT OR IGNORE INTO curriculum_archives VALUES(?,?)').run(source.id,Date.now());
        return {ok:true,moved:rows.map(r=>r.question_id)};
      }else fail(400,'과목 관리 동작을 확인해 주세요.');
      return {ok:true};
    });
  }
  async function add(u, b) {
    if (u.role !== 'admin') fail(403, '관리자만 과목·단원을 추가할 수 있어요.');
    const name = String(b.name ?? '').trim();
    if (!name || name.length > 100) fail(400, '이름은 1~100자로 입력하세요.');
    return db.transaction(async () => {
      if (b.kind === 'subject') {
        if (await db.prepare('SELECT id FROM curriculum_subjects WHERE name=? COLLATE NOCASE').get(name)) fail(409, '이미 등록된 과목이에요.');
        const id = 'custom-' + randomUUID();
        await db.prepare('INSERT INTO curriculum_subjects VALUES(?,?,?,?,?)').run(id, name, '＋', '관리자가 추가한 과목', '관리자 공식');
        return {
          id
        };
      }
      if (b.kind !== 'unit' || !(await db.prepare('SELECT id FROM curriculum_subjects WHERE id=? AND id NOT IN(SELECT subject FROM curriculum_archives)').get(b.subject))) fail(400, '과목을 선택하세요.');
      if (await db.prepare('SELECT number FROM curriculum_units WHERE subject=? AND title=? COLLATE NOCASE').get(b.subject, name)) fail(409, '이미 등록된 단원이에요.');
      const number = (await db.prepare('SELECT COALESCE(MAX(number),0)+1 n FROM curriculum_units WHERE subject=?').get(b.subject)).n;
      if (number > 200) fail(400, '과목당 단원은 최대 200개입니다.');
      await db.prepare('INSERT INTO curriculum_units VALUES(?,?,?)').run(b.subject, number, name);
      return {
        subject: b.subject,
        number
      };
    });
  }
  return {
    list,
    manage,
    add
  };
}
