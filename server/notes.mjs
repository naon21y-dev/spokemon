import { fail, kstDay } from './service.mjs';
export async function createNotes(service, {
  clock = () => Date.now()
} = {}) {
  const db = service.db;
  await db.exec('CREATE TABLE IF NOT EXISTS daily_notes(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,title TEXT NOT NULL,body TEXT NOT NULL,version INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,day))');
  function day(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value + 'T00:00:00Z')) || new Date(value + 'T00:00:00Z').toISOString().slice(0, 10) !== value) fail(400, '날짜를 확인해 주세요.');
    return value;
  }
  async function read(u, date = kstDay(clock())) {
    service.student(u);
    date = day(date);
    const row = await db.prepare('SELECT day,title,body,version,updated_at FROM daily_notes WHERE user_id=? AND day=?').get(u.id, date);
    return {
      note: row ?? {
        day: date,
        title: '',
        body: '',
        version: 0,
        updated_at: null
      },
      items: await db.prepare('SELECT day,title,updated_at FROM daily_notes WHERE user_id=? ORDER BY day DESC LIMIT 90').all(u.id)
    };
  }
  async function save(u, date, b) {
    service.student(u);
    date = day(date);
    if (!b || typeof b.title !== 'string' || typeof b.body !== 'string' || b.title.length > 100 || b.body.length > 20000 || !Number.isSafeInteger(b.version) || b.version < 0) fail(400, '제목은 100자, 메모는 20,000자 이내로 입력하세요.');
    return await db.transaction(async () => {
      const old = await db.prepare('SELECT version FROM daily_notes WHERE user_id=? AND day=?').get(u.id, date);
      if ((old?.version ?? 0) !== b.version) fail(409, '다른 화면에서 메모가 변경됐어요. 내용을 복사한 뒤 서버 메모를 다시 불러와 주세요.');
      await db.prepare('INSERT INTO daily_notes VALUES(?,?,?,?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET title=excluded.title,body=excluded.body,version=excluded.version,updated_at=excluded.updated_at').run(u.id, date, b.title, b.body, b.version + 1, clock());
      return await read(u, date);
    });
  }
  return {
    read,
    save
  };
}
