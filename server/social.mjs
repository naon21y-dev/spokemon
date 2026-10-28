import { randomUUID } from 'node:crypto';
import { fail } from './service.mjs';
export async function createSocial(service) {
  const db = service.db,
    get = async (q, ...a) => await db.prepare(q).get(...a),
    all = async (q, ...a) => await db.prepare(q).all(...a),
    run = async (q, ...a) => await db.prepare(q).run(...a);
  await db.exec(`CREATE TABLE IF NOT EXISTS friendships(sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),accepted INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(sender,recipient));CREATE TABLE IF NOT EXISTS friend_mail(id TEXT PRIMARY KEY,sender TEXT NOT NULL REFERENCES users(id),recipient TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,body TEXT NOT NULL,created_at INTEGER NOT NULL,read_at INTEGER,request_key TEXT NOT NULL,UNIQUE(sender,request_key));`);
  async function friend(u, id) {
    service.student(u);
    if (!(await get('SELECT id FROM users WHERE id=? AND deleted_at IS NULL', id))) fail(404, '삭제된 계정에는 쪽지를 보낼 수 없어요.');
    if (!(await get('SELECT 1 FROM friendships WHERE accepted=1 AND ((sender=? AND recipient=?) OR (sender=? AND recipient=?))', u.id, id, id, u.id))) fail(403, '친구 추가를 수락한 학생에게만 쪽지를 보낼 수 있어요.');
  }
  async function summary(u) {
    service.student(u);
    return (await get('SELECT COUNT(*) n FROM friend_mail WHERE recipient=? AND read_at IS NULL', u.id)).n;
  }
  async function list(u) {
    service.student(u);
    return {
      friends: await all(`SELECT u.id,u.login,u.name,f.accepted,f.sender FROM friendships f JOIN users u ON u.id=CASE WHEN f.sender=? THEN f.recipient ELSE f.sender END WHERE (f.sender=? OR f.recipient=?) AND u.deleted_at IS NULL`, u.id, u.id, u.id),
      items: await all('SELECT m.id,m.title,m.sender,m.recipient,m.created_at,m.read_at,u.name sender_name,v.name recipient_name FROM friend_mail m JOIN users u ON u.id=m.sender JOIN users v ON v.id=m.recipient WHERE m.sender=? OR m.recipient=? ORDER BY m.created_at DESC,m.rowid DESC', u.id, u.id),
      unread: await summary(u)
    };
  }
  async function search(u, login) {
    service.student(u);
    login = String(login ?? '').trim();
    if (login.length < 3) return {
      student: null
    };
    return {
      student: (await get("SELECT id,login,name FROM users WHERE login=? COLLATE NOCASE AND role='student' AND deleted_at IS NULL AND id<>?", login, u.id)) ?? null
    };
  }
  async function add(u, id) {
    return await db.transaction(async () => {
      service.student(u);
      if (id === u.id || !(await get("SELECT id FROM users WHERE id=? AND role='student' AND deleted_at IS NULL", id))) fail(404, '학생을 찾을 수 없어요.');
      const reverse = await get('SELECT * FROM friendships WHERE sender=? AND recipient=?', id, u.id);
      if (reverse) await run('UPDATE friendships SET accepted=1 WHERE sender=? AND recipient=?', id, u.id);else await run('INSERT OR IGNORE INTO friendships VALUES (?,?,0)', u.id, id);
      return await list(u);
    });
  }
  async function send(u, b) {
    return await db.transaction(async () => {
      await friend(u, b.recipient);
      const title = String(b.title ?? '').trim(),
        body = String(b.content ?? '').trim(),
        key = String(b.requestKey ?? '');
      if (!title || title.length > 100 || !body || body.length > 5000 || !/^[\w-]{8,100}$/.test(key)) fail(400, '제목과 내용을 확인해 주세요.');
      const prior = await get('SELECT * FROM friend_mail WHERE sender=? AND request_key=?', u.id, key);
      if (prior) {
        if (prior.recipient !== b.recipient || prior.title !== title || prior.body !== body) fail(409, '전송 내용이 바뀌었어요.');
        return {
          id: prior.id
        };
      }
      const duplicate = await get('SELECT id FROM friend_mail WHERE sender=? AND recipient=? AND title=? AND body=? AND created_at>?', u.id, b.recipient, title, body, Date.now() - 60000);
      if (duplicate) return duplicate;
      const id = randomUUID();
      await run('INSERT INTO friend_mail VALUES (?,?,?,?,?,?,NULL,?)', id, u.id, b.recipient, title, body, Date.now(), key);
      return {
        id
      };
    });
  }
  async function detail(u, id, read = false) {
    service.student(u);
    const m = await get('SELECT m.*,u.name sender_name,v.name recipient_name FROM friend_mail m JOIN users u ON u.id=m.sender JOIN users v ON v.id=m.recipient WHERE m.id=? AND (m.sender=? OR m.recipient=?)', id, u.id, u.id);
    if (!m) fail(404, '쪽지를 찾을 수 없어요.');
    if (read && m.recipient === u.id && !m.read_at) {
      m.read_at = Date.now();
      await run('UPDATE friend_mail SET read_at=? WHERE id=? AND recipient=?', m.read_at, id, u.id);
    }
    return m;
  }
  return {
    summary,
    list,
    search,
    add,
    send,
    detail
  };
}
