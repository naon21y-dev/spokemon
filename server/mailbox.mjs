import { randomUUID, createHash } from 'node:crypto';
import { fail } from './service.mjs';
import { createMail } from './mail.mjs';
import { createSocial } from './social.mjs';
async function tools(db) {
  await db.exec(`CREATE TABLE IF NOT EXISTS mailbox_hidden(user_id TEXT NOT NULL REFERENCES users(id),kind TEXT NOT NULL,message_id TEXT NOT NULL,hidden_at INTEGER NOT NULL,PRIMARY KEY(user_id,kind,message_id));CREATE TABLE IF NOT EXISTS mailbox_senders(message_id TEXT PRIMARY KEY REFERENCES private_messages(id),sender_id TEXT NOT NULL REFERENCES users(id));`);
  return {
    hidden: async (u, kind, id) => !!(await db.prepare('SELECT 1 FROM mailbox_hidden WHERE user_id=? AND kind=? AND message_id=?').get(u.id, kind, id)),
    hide: async (u, kind, id) => {
      await db.prepare('INSERT OR IGNORE INTO mailbox_hidden VALUES(?,?,?,?)').run(u.id, kind, id, Date.now());
      return {
        ok: true
      };
    }
  };
}
export async function createPrivateMailbox(service) {
  const base = await createMail(service),
    db = service.db,
    t = await tools(db),
    get = (q, ...a) => db.prepare(q).get(...a),
    all = (q, ...a) => db.prepare(q).all(...a),
    run = (q, ...a) => db.prepare(q).run(...a);
  async function summary(u) {
    const filter = 'NOT EXISTS(SELECT 1 FROM mailbox_hidden h WHERE h.user_id=? AND h.kind=\'private\' AND h.message_id=m.id)';
    if (u.role === 'admin') return {
      unread: 0,
      pending: (await get("SELECT COUNT(*) n FROM private_messages m WHERE " + filter + " AND COALESCE((SELECT u.role FROM private_replies r JOIN users u ON u.id=r.admin_id WHERE r.message_id=m.id ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1),'student')='student'", u.id)).n
    };
    service.student(u);
    return {
      pending: 0,
      unread: (await get("SELECT COUNT(*) n FROM private_replies r JOIN private_messages m ON m.id=r.message_id JOIN users a ON a.id=r.admin_id WHERE m.student_id=? AND a.role='admin' AND r.read_at IS NULL AND " + filter, u.id, u.id)).n
    };
  }
  async function detail(u, id, admin = false) {
    if (await t.hidden(u, 'private', id)) fail(404, '삭제한 쪽지입니다.');
    const m = await base.detail(u, id, admin),
      sender = await get('SELECT sender_id FROM mailbox_senders WHERE message_id=?', id);
    const replies = await all('SELECT r.id,u.role sender_role FROM private_replies r JOIN users u ON u.id=r.admin_id WHERE r.message_id=? ORDER BY r.created_at,r.rowid', id);
    return {
      ...m,
      status: replies.at(-1)?.sender_role === 'admin' ? 'answered' : 'pending',
      fromAdmin: !!sender,
      senderId: sender?.sender_id,
      replies: m.replies.map(r => ({
        ...r,
        senderRole: replies.find(x => x.id === r.id)?.sender_role ?? 'admin'
      }))
    };
  }
  async function list(u, filters = {}, admin = false) {
    const result = await base.list(u, {
        ...filters,
        status: ''
      }, admin),
      hidden = new Set((await all("SELECT message_id FROM mailbox_hidden WHERE user_id=? AND kind='private'", u.id)).map(r => r.message_id)),
      meta = await all("SELECT m.id,s.sender_id,(SELECT COUNT(*) FROM private_replies rr JOIN users aa ON aa.id=rr.admin_id WHERE rr.message_id=m.id AND aa.role='admin' AND rr.read_at IS NULL) unread_count,(SELECT u.role FROM private_replies r JOIN users u ON u.id=r.admin_id WHERE r.message_id=m.id ORDER BY r.created_at DESC,r.rowid DESC LIMIT 1) last_role FROM private_messages m LEFT JOIN mailbox_senders s ON s.message_id=m.id"),
      byId = new Map(meta.map(m => [m.id, m]));
    return {
      items: result.items.filter(m => !hidden.has(m.id)).map(m => ({
        ...m,
        unread_count: byId.get(m.id)?.unread_count ?? 0,
        fromAdmin: !!byId.get(m.id)?.sender_id,
        status: byId.get(m.id)?.last_role === 'admin' ? 'answered' : 'pending'
      })).filter(m => !filters.status || m.status === filters.status),
      ...(await summary(u))
    };
  }
  async function remove(u, id, admin = false) {
    await detail(u, id, admin);
    return t.hide(u, 'private', id);
  }
  async function once(u, kind, key, parts, fn) {
    if (typeof key !== 'string' || !/^[-\w]{8,100}$/.test(key)) fail(400, '전송 식별자를 확인하세요.');
    const hash = createHash('sha256').update(JSON.stringify(parts)).digest('hex');
    return db.transaction(async () => {
      const old = await get('SELECT * FROM mail_requests WHERE actor_id=? AND kind=? AND request_key=?', u.id, kind, key);
      if (old) {
        if (old.fingerprint !== hash) fail(409, '전송 내용이 변경됐어요.');
        return {
          id: old.resource_id
        };
      }
      const id = await fn();
      await run('INSERT INTO mail_requests VALUES(?,?,?,?,?)', u.id, kind, key, id, hash);
      return {
        id
      };
    });
  }
  function content(b) {
    const title = String(b.title ?? '').trim(),
      body = String(b.content ?? '').trim();
    if (!body || body.length > 5000 || !title || title.length > 100) fail(400, '제목과 내용을 확인하세요.');
    return {
      title,
      body
    };
  }
  async function recipients(u, search = '') {
    service.admin(u);
    return {
      items: await all("SELECT u.id,u.name,u.login,c.name class_name FROM users u LEFT JOIN classes c ON c.id=u.class_id WHERE u.role='student' AND u.deleted_at IS NULL AND (u.name LIKE ? OR u.login LIKE ?) ORDER BY u.name LIMIT 100", '%' + String(search).slice(0, 100) + '%', '%' + String(search).slice(0, 100) + '%')
    };
  }
  async function sendAdmin(u, b) {
    service.admin(u);
    const {
      title,
      body
    } = content(b);
    return once(u, 'admin-message', b.requestKey, [b.studentId, title, body], async () => {
      if (!(await get("SELECT id FROM users WHERE id=? AND role='student' AND deleted_at IS NULL", b.studentId))) fail(404, '학생을 찾을 수 없어요.');
      const id = randomUUID(),
        now = Date.now();
      await run('INSERT INTO private_messages VALUES(?,?,?,?,?,?)', id, b.studentId, 'general', title, body, now);
      await run('INSERT INTO mailbox_senders VALUES(?,?)', id, u.id);
      await run('INSERT INTO private_replies VALUES(?,?,?,?,?,NULL)', randomUUID(), id, u.id, body, now);
      return id;
    });
  }
  async function studentReply(u, id, b) {
    service.student(u);
    await detail(u, id);
    const body = String(b.content ?? '').trim();
    if (!body || body.length > 5000) fail(400, '답장 내용을 확인하세요.');
    return once(u, 'student-reply', b.requestKey, [id, body], async () => {
      const rid = randomUUID();
      await run('INSERT INTO private_replies VALUES(?,?,?,?,?,NULL)', rid, id, u.id, body, Date.now());
      return rid;
    });
  }
  return {
    ...base,
    summary,
    detail,
    list,
    remove,
    recipients,
    sendAdmin,
    studentReply
  };
}
export async function createSocialMailbox(service) {
  const base = await createSocial(service),
    db = service.db,
    t = await tools(db);
  async function summary(u) {
    service.student(u);
    return (await db.prepare("SELECT COUNT(*) n FROM friend_mail m WHERE recipient=? AND read_at IS NULL AND NOT EXISTS(SELECT 1 FROM mailbox_hidden h WHERE h.user_id=? AND h.kind='friend' AND h.message_id=m.id)").get(u.id, u.id)).n;
  }
  async function detail(u, id, read = false) {
    if (await t.hidden(u, 'friend', id)) fail(404, '삭제한 쪽지입니다.');
    return base.detail(u, id, read);
  }
  async function list(u) {
    const data = await base.list(u),
      ids = new Set((await db.prepare("SELECT message_id FROM mailbox_hidden WHERE user_id=? AND kind='friend'").all(u.id)).map(r => r.message_id));
    return {
      ...data,
      items: data.items.filter(m => !ids.has(m.id)),
      unread: await summary(u)
    };
  }
  return {
    ...base,
    summary,
    detail,
    list,
    remove: async (u, id) => {
      await detail(u, id);
      return t.hide(u, 'friend', id);
    }
  };
}
