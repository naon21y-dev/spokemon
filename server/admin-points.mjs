import { randomUUID } from 'node:crypto';
import { fail } from './service.mjs';
export async function createAdminPoints(service, {
  clock = () => Date.now()
} = {}) {
  const db = service.db,
    get = (sql, ...args) => db.prepare(sql).get(...args),
    all = (sql, ...args) => db.prepare(sql).all(...args);
  await db.exec(`CREATE TABLE IF NOT EXISTS admin_point_grants(id TEXT PRIMARY KEY REFERENCES ledger(id),admin_id TEXT NOT NULL REFERENCES users(id),student_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL CHECK(amount>0),reason TEXT NOT NULL,request_key TEXT NOT NULL,created_at INTEGER NOT NULL,UNIQUE(admin_id,request_key));CREATE INDEX IF NOT EXISTS admin_point_student ON admin_point_grants(student_id,created_at);`);
  async function admin(u) {
    service.admin(u);
    const current = await get("SELECT id,name,role FROM users WHERE id=? AND deleted_at IS NULL", u.id);
    if (!current || current.role !== 'admin') fail(403, '관리자만 포인트를 지급할 수 있어요.');
    return current;
  }
  async function student(id) {
    const target = await get("SELECT id,login,name,coins FROM users WHERE id=? AND role='student' AND deleted_at IS NULL", id);
    if (!target) fail(404, '포인트를 지급할 학생을 찾을 수 없어요.');
    return target;
  }
  async function read(u, id) {
    await admin(u);
    const target = await student(id);
    return {
      student: {
        id: target.id,
        name: target.name,
        login: target.login
      },
      balance: target.coins,
      grants: await all('SELECT g.id,g.amount,g.reason,g.created_at,u.name admin_name FROM admin_point_grants g JOIN users u ON u.id=g.admin_id WHERE g.student_id=? ORDER BY g.created_at DESC,g.rowid DESC LIMIT 20', id)
    };
  }
  async function grant(u, id, b) {
    service.admin(u);
    const amount = b?.amount,
      reason = typeof b?.reason === 'string' ? b.reason.trim() : '',
      key = b?.requestKey;
    if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000 || !reason || reason.length > 200 || typeof key !== 'string' || !/^[-\w]{8,100}$/.test(key)) fail(400, '1~1,000,000 정수 포인트와 1~200자 지급 사유를 입력하세요.');
    return db.transaction(async () => {
      const actor = await admin(u),
        old = await get('SELECT * FROM admin_point_grants WHERE admin_id=? AND request_key=?', u.id, key);
      if (old) {
        if (old.student_id !== id || old.amount !== amount || old.reason !== reason) fail(409, '같은 지급 식별자의 내용이 바뀌었어요. 지급 내역을 확인하세요.');
        return {
          id: old.id,
          duplicate: true,
          ...(await read(u, id))
        };
      }
      const target = await student(id);
      if (!Number.isSafeInteger(target.coins + amount)) fail(400, '학생의 보유 포인트 한도를 초과합니다.');
      const ledgerId = randomUUID(),
        now = clock();
      await db.batch([{
        sql: 'INSERT INTO ledger VALUES(?,?,?,?,?,?,?)',
        args: [ledgerId, id, amount, '관리자 포인트 지급', actor.name + ' 관리자 · ' + reason, 'admin-grant:' + u.id + ':' + key, now]
      }, {
        sql: 'INSERT INTO admin_point_grants VALUES(?,?,?,?,?,?,?)',
        args: [ledgerId, u.id, id, amount, reason, key, now]
      }, {
        sql: 'UPDATE users SET coins=coins+? WHERE id=?',
        args: [amount, id]
      }]);
      return {
        id: ledgerId,
        duplicate: false,
        ...(await read(u, id))
      };
    });
  }
  return {
    read,
    grant
  };
}
