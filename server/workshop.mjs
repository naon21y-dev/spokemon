import { randomUUID, createHash } from 'node:crypto';
import { fail, kstDay } from './service.mjs';
export async function createWorkshop(service, {
  clock = () => Date.now(),
  questionMap,
  officialQuestions,
  insertQuiz,
  allowed
} = {}) {
  const db = service.db,
    get = async (q, ...a) => await db.prepare(q).get(...a),
    all = async (q, ...a) => await db.prepare(q).all(...a),
    run = async (q, ...a) => await db.prepare(q).run(...a),
    parse = s => JSON.parse(s);
  await db.exec(`CREATE TABLE IF NOT EXISTS workshop_posts(id TEXT PRIMARY KEY,author_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,unit INTEGER NOT NULL,title TEXT NOT NULL,version INTEGER NOT NULL,published INTEGER NOT NULL,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS workshop_versions(question_id TEXT PRIMARY KEY,post_id TEXT NOT NULL REFERENCES workshop_posts(id),version INTEGER NOT NULL,content TEXT NOT NULL,UNIQUE(post_id,version));
 CREATE TABLE IF NOT EXISTS problem_origins(question_id TEXT PRIMARY KEY,source TEXT NOT NULL,creator_id TEXT,original_id TEXT NOT NULL,version INTEGER NOT NULL,title TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS reward_settings(id INTEGER PRIMARY KEY CHECK(id=1),official INTEGER NOT NULL,student INTEGER NOT NULL,daily_cap INTEGER NOT NULL);
 INSERT OR IGNORE INTO reward_settings VALUES(1,20,10,100);
 CREATE TABLE IF NOT EXISTS workshop_batches(user_id TEXT NOT NULL REFERENCES users(id),request_key TEXT NOT NULL,fingerprint TEXT NOT NULL,result TEXT NOT NULL,PRIMARY KEY(user_id,request_key));
 CREATE TABLE IF NOT EXISTS reward_days(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,amount INTEGER NOT NULL,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS ledger_details(ledger_id TEXT PRIMARY KEY REFERENCES ledger(id),source TEXT NOT NULL,creator_id TEXT,creator_name TEXT NOT NULL,problem_title TEXT NOT NULL,original_id TEXT NOT NULL,version INTEGER NOT NULL,reason TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS study_source_days(user_id TEXT NOT NULL REFERENCES users(id),source TEXT NOT NULL,day TEXT NOT NULL,ms INTEGER NOT NULL,PRIMARY KEY(user_id,source,day));
 CREATE TABLE IF NOT EXISTS study_source_subject_days(user_id TEXT NOT NULL REFERENCES users(id),source TEXT NOT NULL,subject TEXT NOT NULL,day TEXT NOT NULL,ms INTEGER NOT NULL,PRIMARY KEY(user_id,source,subject,day));
 CREATE TABLE IF NOT EXISTS study_clock_source(user_id TEXT PRIMARY KEY REFERENCES users(id),source TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS ai_generation_limits(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,count INTEGER NOT NULL,PRIMARY KEY(user_id,day));`);
  const knownOrigins = new Set((await all('SELECT question_id FROM problem_origins')).map(r => r.question_id)),
    originBatch = [];
  for (const q of officialQuestions) {
    Object.assign(q, {
      source: 'official',
      creatorId: null,
      creatorName: '관리자',
      originalId: q.id,
      version: 1
    });
    if (!knownOrigins.has(q.id)) originBatch.push({
      sql: 'INSERT OR IGNORE INTO problem_origins VALUES (?,?,?,?,?,?)',
      args: [q.id, 'official', null, q.id, 1, q.prompt]
    });
  }
  if (originBatch.length) await db.batch(originBatch);
  async function loadQuestions(ids) {
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      for (const row of await all('SELECT v.content,u.name creator_name,u.login creator_login FROM workshop_versions v JOIN workshop_posts p ON p.id=v.post_id JOIN users u ON u.id=p.author_id WHERE v.question_id IN (' + chunk.map(() => '?').join(',') + ')', ...chunk)) hydrate(row);
    }
  }
  function hydrate(row) {
    const q = parse(row.content);
    q.creatorName = row.creator_name ?? q.creatorName ?? '학생';
    q.creatorLogin = row.creator_login ?? q.creatorLogin ?? '';
    questionMap[q.id] = q;
    return q;
  }
  for (const row of await all('SELECT * FROM workshop_versions')) hydrate(row);
  const legacyLedger = [];
  for (const row of await all("SELECT l.* FROM ledger l WHERE l.kind='퀴즈 최초 정답' AND NOT EXISTS(SELECT 1 FROM ledger_details d WHERE d.ledger_id=l.id)")) {
    const id = row.unique_key.split(':quiz:')[1],
      q = questionMap[id];
    if (q) legacyLedger.push({
      sql: 'INSERT OR IGNORE INTO ledger_details VALUES(?,?,?,?,?,?,?,?)',
      args: [row.id, 'official', null, '관리자', q.prompt, q.id, 1, '최초 정답 · 기존 기록']
    });
  }
  for (let i = 0; i < legacyLedger.length; i += 200) await db.batch(legacyLedger.slice(i, i + 200));
  const tx = async fn => await db.transaction(fn);
  async function settings(u, body) {
    if (body) {
      service.admin(u);
      for (const key of ['official', 'student', 'dailyCap']) if (!Number.isSafeInteger(body[key]) || body[key] < 0 || body[key] > 100000) fail(400, '포인트는 0~100,000 정수로 설정하세요.');
      await run('UPDATE reward_settings SET official=?,student=?,daily_cap=? WHERE id=1', body.official, body.student, body.dailyCap);
    }
    const row = await get('SELECT * FROM reward_settings WHERE id=1');
    return {
      official: row.official,
      student: row.student,
      dailyCap: row.daily_cap
    };
  }
  async function grant(u, q, now) {
    const source = q.source ?? 'official',
      root = q.originalId ?? q.id,
      config = await settings(),
      amount = source === 'official' ? config.official : config.student;
    if (amount === 0 || source === 'student' && q.creatorId === u.id) return 0;
    if (await get('SELECT 1 FROM quiz_awards WHERE user_id=? AND question_id=?', u.id, root)) return 0;
    const day = kstDay(now),
      used = (await get('SELECT amount FROM reward_days WHERE user_id=? AND day=?', u.id, day))?.amount ?? 0,
      pay = source === 'student' ? Math.min(amount, Math.max(0, config.dailyCap - used)) : amount;
    if (!pay) return 0;
    const won = await run('INSERT OR IGNORE INTO quiz_awards VALUES(?,?,?,?)', u.id, root, pay, now);
    if (!won.changes) return 0;
    if (source === 'student') await run('INSERT INTO reward_days VALUES(?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET amount=amount+excluded.amount', u.id, day, pay);
    const retry = !!(await get('SELECT 1 FROM mistakes WHERE user_id=? AND question_id=?', u.id, q.id)),
      reason = (retry ? '재도전 최초 정답' : '최초 정답') + (pay < amount ? ' · 일일 한도 일부 지급' : ''),
      id = randomUUID();
    await run('UPDATE users SET coins=coins+? WHERE id=?', pay, u.id);
    await run('INSERT INTO ledger VALUES(?,?,?,?,?,?,?)', id, u.id, pay, source === 'student' ? '학생 제작 문제 정답' : '퀴즈 최초 정답', (source === 'student' ? '학생 제작' : '공식 문제') + ' · ' + q.creatorName + ' · ' + (q.title ?? q.prompt) + ' · ' + reason, u.id + ':quiz:' + root, now);
    await run('INSERT INTO ledger_details VALUES(?,?,?,?,?,?,?,?)', id, source, q.creatorId ?? null, q.creatorName ?? '관리자', q.title ?? q.prompt, root, q.version ?? 1, reason);
    return pay;
  }
  function validate(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, '문제 내용을 확인하세요.');
    const subject = String(body.subject ?? ''),
      unit = Number(body.unit),
      title = String(body.title ?? '').trim(),
      prompt = String(body.prompt ?? '').trim(),
      explanation = String(body.explanation ?? '').trim(),
      type = body.type;
    if (typeof subject !== 'string' || !Number.isInteger(unit) || unit < 0 || unit > 200 || !title || title.length > 100 || !prompt || prompt.length > 1500 || !explanation || explanation.length > 3000 || !['multiple', 'short'].includes(type)) fail(400, '과목·단원·제목·문제·해설을 확인해 주세요.');
    let extra = {};
    if (type === 'multiple') {
      if (!Array.isArray(body.options) || body.options.length !== 4) fail(400, '선택지는 4개가 필요합니다.');
      const options = body.options.map((o, i) => ({
        id: 'choice-' + i,
        text: String(o.text ?? '').trim()
      }));
      if (options.some(o => !o.text || o.text.length > 300) || new Set(options.map(o => o.text)).size !== 4 || !options.some(o => o.id === body.correctOptionId)) fail(400, '서로 다른 선택지 4개와 정답을 지정하세요.');
      extra = {
        options,
        correctOptionId: body.correctOptionId
      };
    } else {
      if (!Array.isArray(body.acceptedAnswers) || !body.acceptedAnswers.length || body.acceptedAnswers.length > 20) fail(400, '허용 정답을 입력하세요.');
      const acceptedAnswers = [...new Set(body.acceptedAnswers.map(a => String(a).trim()))];
      if (acceptedAnswers.some(a => !a || a.length > 200)) fail(400, '허용 정답을 확인하세요.');
      extra = {
        acceptedAnswers
      };
    }
    return {
      subject,
      unit,
      title,
      prompt,
      explanation,
      type,
      ...extra
    };
  }
  async function permitted(u, subject, unit) {
    const subjectMap = Object.fromEntries((await service.curriculum()).map(s => [s.id, s]));
    if (!subjectMap[subject] || unit !== 0 && !subjectMap[subject].units.some(u => u.number === unit)) fail(400, '과목·단원을 확인하세요.');
    if (u.role === 'admin') return;
    service.student(u);
    if (unit === 0 && subjectMap[subject]) return;
    if (!(await service.catalog(u)).find(s => s.id === subject)?.releasedUnits.includes(unit)) fail(403, '아직 배우지 않은 단원입니다');
  }
  async function saveOne(u, body, id, batchContext) {
    if (!['admin', 'student'].includes(u.role)) fail(403, '로그인이 필요합니다.');
    const content = validate(body);
    if (u.role === 'admin' && content.unit === 0) fail(400, '공식 문제의 단원을 선택하세요.');
    if (body.published === true && body.reviewed !== true) fail(400, '공유하기 전에 정답·해설 검토를 완료해 주세요.');
    if (batchContext) {
      if (!batchContext.releases.find(s => s.id === content.subject) || content.unit !== 0 && !batchContext.releases.find(s => s.id === content.subject)?.units.some(v => v.number === content.unit)) fail(400, '과목·단원을 확인하세요.');
      if (u.role !== 'admin' && content.unit !== 0 && !batchContext.releases.find(s => s.id === content.subject)?.releasedUnits.includes(content.unit)) fail(403, '아직 배우지 않은 단원입니다');
    } else await permitted(u, content.subject, content.unit);
    const old = id ? await get('SELECT * FROM workshop_posts WHERE id=?', id) : null;
    if (id && (!old || old.author_id !== u.id)) fail(403, '본인이 작성한 문제만 수정할 수 있어요.');
    if (old && Number(body.baseVersion) !== old.version) fail(409, '다른 화면에서 수정되었습니다. 문제를 다시 열어 주세요.');
    if (u.role !== 'admin' && !id && !batchContext && (await all('SELECT id FROM workshop_posts WHERE author_id=? AND created_at>?', u.id, clock() - 86400000)).length >= 20) fail(429, '하루에 20개까지 작성할 수 있어요.');
    const root = id ?? randomUUID(),
      version = (old?.version ?? 0) + 1,
      questionId = root + ':v' + version,
      q = {
        ...content,
        id: questionId,
        source: u.role === 'admin' ? 'official' : 'student',
        creatorId: u.id,
        creatorName: u.name,
        creatorLogin: u.login,
        originalId: root,
        postId: root,
        version
      };
    if (batchContext) {
      batchContext.statements.push({
        sql: 'INSERT INTO workshop_posts VALUES(?,?,?,?,?,?,?,?,?)',
        args: [root, u.id, q.subject, q.unit, q.title, version, body.published === true ? 1 : 0, clock(), clock()]
      }, {
        sql: 'INSERT INTO workshop_versions VALUES(?,?,?,?)',
        args: [q.id, root, version, JSON.stringify(q)]
      }, {
        sql: 'INSERT INTO problem_origins VALUES(?,?,?,?,?,?)',
        args: [q.id, q.source, u.id, root, version, q.title]
      });
      batchContext.questions.push(q);
      return {
        id: root,
        version
      };
    }
    if (old) await run('UPDATE workshop_posts SET subject=?,unit=?,title=?,version=?,published=?,updated_at=? WHERE id=?', q.subject, q.unit, q.title, version, body.published === true ? 1 : 0, clock(), root);else await run('INSERT INTO workshop_posts VALUES(?,?,?,?,?,?,?,?,?)', root, u.id, q.subject, q.unit, q.title, version, body.published === true ? 1 : 0, clock(), clock());
    await run('INSERT INTO workshop_versions VALUES(?,?,?,?)', q.id, root, version, JSON.stringify(q));
    await run('INSERT INTO problem_origins VALUES(?,?,?,?,?,?)', q.id, q.source, u.id, root, version, q.title);
    questionMap[q.id] = q;
    return {
      id: root,
      version
    };
  }
  async function save(u, body, id) {
    return await tx(async () => await saveOne(u, body, id));
  }
  async function saveBatch(u, body) {
    if (!['admin', 'student'].includes(u.role)) fail(403, '로그인이 필요합니다.');
    if (!Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 20 || typeof body.requestKey !== 'string' || !/^[a-zA-Z0-9_-]{8,100}$/.test(body.requestKey)) fail(400, '1~20개 문제와 저장 식별자를 확인하세요.');
    const fingerprint = createHash('sha256').update(JSON.stringify(body.questions)).digest('hex');
    return await tx(async () => {
      const prior = await get('SELECT * FROM workshop_batches WHERE user_id=? AND request_key=?', u.id, body.requestKey);
      if (prior) {
        if (prior.fingerprint !== fingerprint) fail(409, '저장 내용이 변경되었습니다. 다시 저장하세요.');
        return parse(prior.result);
      }
      const count = (await get('SELECT COUNT(*) n FROM workshop_posts WHERE author_id=? AND created_at>?', u.id, clock() - 86400000)).n;
      if (u.role !== 'admin' && count + body.questions.length > 20) fail(429, '하루에 20개까지 작성할 수 있어요.');
      const context = {
          releases: u.role === 'admin' ? await service.curriculum() : await service.catalog(u),
          statements: [],
          questions: []
        },
        items = [];
      for (const [i, q] of body.questions.entries()) {
        try {
          items.push(await saveOne(u, q, undefined, context));
        } catch (e) {
          if (e.status) e.message = '문제 ' + (i + 1) + ': ' + e.message;
          throw e;
        }
      }
      await db.batch(context.statements);
      for (const q of context.questions) questionMap[q.id] = q;
      const result = {
        items
      };
      await run('INSERT INTO workshop_batches VALUES(?,?,?,?)', u.id, body.requestKey, fingerprint, JSON.stringify(result));
      return result;
    });
  }
  async function accessible(u, id, edit = false) {
    const row = await get('SELECT * FROM workshop_posts WHERE id=?', id);
    if (!row || (await get('SELECT deleted_at FROM users WHERE id=?', row.author_id))?.deleted_at != null) fail(404, '문제를 찾을 수 없어요.');
    if (edit) {
      await permitted(u, row.subject, row.unit);
      if (row.author_id !== u.id) fail(403, '작성자만 편집할 수 있어요.');
    } else if (u.role !== 'admin') {
      await permitted(u, row.subject, row.unit);
      if (!row.published && row.author_id !== u.id) fail(404, '공유되지 않은 문제입니다.');
    }
    return row;
  }
  async function detail(u, id, edit = false) {
    const row = await accessible(u, id, edit),
      q = hydrate(await get('SELECT * FROM workshop_versions WHERE post_id=? AND version=?', id, row.version)),
      safe = {
        ...q,
        published: !!row.published
      };
    if (!edit) {
      delete safe.correctOptionId;
      delete safe.acceptedAnswers;
      delete safe.explanation;
    }
    return safe;
  }
  async function list(u, filters = {}) {
    const releases = u.role === 'student' ? await service.catalog(u) : null;
    const rows = await all('SELECT p.*,u.name creator_name,u.login creator_login,u.role author_role,u.deleted_at FROM workshop_posts p JOIN users u ON u.id=p.author_id ORDER BY p.updated_at DESC');
    return {
      items: rows.filter(p => (p.published || p.author_id === u.id || u.role === 'admin') && p.deleted_at == null && (!filters.creator || p.author_id === filters.creator) && (!filters.subject || p.subject === filters.subject) && (!filters.mine || p.author_id === u.id)).map(p => ({
        ...p,
        source: p.author_role === 'admin' ? 'official' : 'student',
        originalId: p.id,
        creatorId: p.author_id,
        creatorName: p.creator_name,
        creatorLogin: p.creator_login,
        locked: p.unit !== 0 && u.role === 'student' && !releases.find(s => s.id === p.subject)?.releasedUnits.includes(p.unit),
        ...(p.unit !== 0 && u.role === 'student' && !releases.find(s => s.id === p.subject)?.releasedUnits.includes(p.unit) ? {
          title: '아직 배우지 않은 단원입니다'
        } : {})
      }))
    };
  }
  async function start(u, id) {
    service.student(u);
    const row = await accessible(u, id);
    if (!row.published) fail(403, '공유한 문제만 풀 수 있어요.');
    const q = await detail(u, id);
    return await insertQuiz(u, [q.id], q.subject, q.type, 'community');
  }
  async function moderate(u, id, published) {
    service.admin(u);
    if (!(await get('SELECT id FROM workshop_posts WHERE id=?', id))) fail(404, '문제를 찾을 수 없어요.');
    await run('UPDATE workshop_posts SET published=?,updated_at=? WHERE id=?', published ? 1 : 0, clock(), id);
    return {
      ok: true
    };
  }
  async function analytics(u, source = 'all', targetId, filters = {}) {
    const subjectMap = Object.fromEntries((await service.curriculum()).map(s => [s.id, s]));
    if (!['all', 'official', 'student'].includes(source)) fail(400, '출처를 확인하세요.');
    const target = targetId ?? (u.role === 'student' ? u.id : null);
    if (u.role !== 'admin' && target !== u.id) fail(403, '본인 기록만 확인할 수 있어요.');
    const conditions = [],
      args = [];
    if (target) {
      conditions.push('r.user_id=?');
      args.push(target);
    }
    if (u.role === 'admin' && filters.classId) {
      conditions.push('u.class_id=?');
      args.push(filters.classId);
    }
    if (filters.subject && filters.subject !== 'all') {
      if (!subjectMap[filters.subject]) fail(400, '과목을 확인하세요.');
      conditions.push('r.subject=?');
      args.push(filters.subject);
    }
    const where = conditions.length ? ' WHERE ' + conditions.join(' AND ') : '',
      rows = await all('SELECT r.user_id,r.answers FROM quiz_sessions r JOIN users u ON u.id=r.user_id' + where, ...args),
      stats = {
        official: {
          solved: 0,
          correct: 0,
          wrong: 0
        },
        student: {
          solved: 0,
          correct: 0,
          wrong: 0
        }
      };
    const answers = rows.map(row => parse(row.answers)),
      ids = [...new Set(answers.flatMap(a => Object.keys(a)))],
      origins = new Map();
    for (let i = 0; i < ids.length; i += 200) {
      const chunk = ids.slice(i, i + 200);
      for (const r of await all('SELECT question_id,source FROM problem_origins WHERE question_id IN (' + chunk.map(() => '?').join(',') + ')', ...chunk)) origins.set(r.question_id, r.source);
    }
    for (const row of answers) for (const [id, a] of Object.entries(row)) {
      const origin = origins.get(id) ?? 'official',
        v = stats[origin];
      v.solved++;
      v[a.correct ? 'correct' : 'wrong']++;
    }
    for (const v of Object.values(stats)) v.accuracy = v.solved ? Math.round(v.correct / v.solved * 100) : 0;
    const total = {
      solved: stats.official.solved + stats.student.solved,
      correct: stats.official.correct + stats.student.correct,
      wrong: stats.official.wrong + stats.student.wrong
    };
    total.accuracy = total.solved ? Math.round(total.correct / total.solved * 100) : 0;
    const hasSubject = filters.subject && filters.subject !== 'all',
      totalMs = (await get('SELECT COALESCE(SUM(r.ms),0) ms FROM ' + (hasSubject ? 'study_subject_days' : 'study_days') + ' r JOIN users u ON u.id=r.user_id' + where, ...args)).ms,
      studentMs = (await get('SELECT COALESCE(SUM(r.ms),0) ms FROM ' + (hasSubject ? 'study_source_subject_days' : 'study_source_days') + ' r JOIN users u ON u.id=r.user_id' + (where ? where + " AND r.source='student'" : " WHERE r.source='student'"), ...args)).ms;
    return {
      source,
      stats: {
        all: total,
        ...stats
      },
      selected: source === 'all' ? total : stats[source],
      time: {
        totalSeconds: Math.floor(totalMs / 1000),
        officialSeconds: Math.floor(Math.max(0, totalMs - studentMs) / 1000),
        studentSeconds: Math.floor(studentMs / 1000)
      }
    };
  }
  async function available(u, q) {
    if (q.source !== 'student') return true;
    const row = await get('SELECT p.published,u.deleted_at FROM workshop_posts p JOIN users u ON u.id=p.author_id WHERE p.id=?', q.originalId);
    return !!row?.published && row.deleted_at == null;
  }
  async function officialBank() {
    const rows = await all("SELECT v.content,u.name creator_name,u.login creator_login FROM workshop_posts p JOIN users u ON u.id=p.author_id JOIN workshop_versions v ON v.post_id=p.id AND v.version=p.version WHERE p.published=1 AND u.role='admin' AND u.deleted_at IS NULL");
    return rows.map(hydrate);
  }
  return {
    officialBank,
    settings,
    loadQuestions,
    grant,
    save,
    saveBatch,
    detail,
    list,
    start,
    moderate,
    analytics,
    available,
    validate,
    permitted
  };
}
