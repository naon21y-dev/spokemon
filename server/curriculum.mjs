import { randomUUID } from 'node:crypto';
import { subjects } from './questions/index.js';
import { unitTitle } from '../src/data/curriculum.js';
import { fail } from './service.mjs';
export async function createCurriculum(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS curriculum_subjects(id TEXT PRIMARY KEY,name TEXT NOT NULL COLLATE NOCASE UNIQUE,icon TEXT NOT NULL,description TEXT NOT NULL,source TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS curriculum_units(subject TEXT NOT NULL REFERENCES curriculum_subjects(id),number INTEGER NOT NULL,title TEXT NOT NULL COLLATE NOCASE,PRIMARY KEY(subject,number),UNIQUE(subject,title));`);
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
  async function list() {
    const [subjects, units] = await Promise.all([db.prepare('SELECT * FROM curriculum_subjects ORDER BY rowid').all(), db.prepare('SELECT * FROM curriculum_units ORDER BY number').all()]);
    return subjects.map(s => ({
      ...s,
      units: units.filter(u => u.subject === s.id)
    }));
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
      if (b.kind !== 'unit' || !(await db.prepare('SELECT id FROM curriculum_subjects WHERE id=?').get(b.subject))) fail(400, '과목을 선택하세요.');
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
    add
  };
}
