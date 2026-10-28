import { createAdminPoints } from './admin-points.mjs';
import { createCurriculum } from './curriculum.mjs';
import { createWorkshop } from './workshop.mjs';
import { openDatabase } from './database.mjs';
import { unitTitle } from '../src/data/curriculum.js';
import { itemMap } from '../src/data/items.js';
import { randomUUID, randomBytes, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { questions as builtinQuestions, questionMap as officialMap, subjects as builtinSubjects } from './questions/index.js';
import { isCorrect, answerText, correctText } from './questions/schema.js';
export const fail = (status, message) => {
  const e = new Error(message);
  e.status = status;
  throw e;
};
const parse = (s, fallback = {}) => {
  try {
    return JSON.parse(s);
  } catch {
    return fallback;
  }
};
const json = JSON.stringify;
const shuffle = arr => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
export const unitOf = q => q.unit ?? Math.floor((Number(q.id.split('-').at(-1)) - 1) / (q.type === 'multiple' ? 12 : 8)) + 1;
export const kstDay = ms => new Date(ms + 9 * 3600000).toISOString().slice(0, 10);
const petDefault = () => ({
  character: 'piplup',
  hunger: 70,
  happy: 70,
  xp: 0,
  wear: '',
  owned: [],
  last: Date.now()
});
export async function createService(filename, {
  clock = () => Date.now()
} = {}) {
  const questionMap = {
    ...officialMap
  };
  let workshop,
    curriculum,
    questions = [...builtinQuestions],
    subjects = [...builtinSubjects],
    subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  async function refreshContent() {
    subjects = await curriculum.list();
    subjectMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    if (workshop) questions = [...builtinQuestions, ...(await workshop.officialBank())];
    return subjects;
  }
  const label = (subject, number) => subjectMap[subject]?.units?.find(u => u.number === number)?.title ?? unitTitle(subject, number);
  const db = await openDatabase(filename);
  try {
    await db.exec(`CREATE TABLE IF NOT EXISTS classes(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL);
 CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,login TEXT UNIQUE NOT NULL,name TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('admin','student')),class_id TEXT REFERENCES classes(id),salt TEXT NOT NULL,password TEXT NOT NULL,coins INTEGER NOT NULL DEFAULT 0 CHECK(coins>=0),pet TEXT NOT NULL,game_state TEXT NOT NULL DEFAULT '{}',created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS releases(class_id TEXT NOT NULL REFERENCES classes(id),subject TEXT NOT NULL,max_unit INTEGER NOT NULL CHECK(max_unit BETWEEN 0 AND 5),PRIMARY KEY(class_id,subject));
 CREATE TABLE IF NOT EXISTS release_selections(class_id TEXT NOT NULL REFERENCES classes(id),subject TEXT NOT NULL,units TEXT NOT NULL,PRIMARY KEY(class_id,subject));
 CREATE TABLE IF NOT EXISTS quiz_sessions(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),mode TEXT NOT NULL,subject TEXT NOT NULL,type TEXT NOT NULL,ids TEXT NOT NULL,position INTEGER NOT NULL DEFAULT 0,answers TEXT NOT NULL DEFAULT '{}',draft TEXT NOT NULL DEFAULT '',done INTEGER NOT NULL DEFAULT 0,result TEXT,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS pools(user_id TEXT NOT NULL REFERENCES users(id),pool_key TEXT NOT NULL,remaining TEXT NOT NULL,PRIMARY KEY(user_id,pool_key));
 CREATE TABLE IF NOT EXISTS completions(user_id TEXT NOT NULL REFERENCES users(id),question_id TEXT NOT NULL,completed_at INTEGER NOT NULL,PRIMARY KEY(user_id,question_id));
 CREATE TABLE IF NOT EXISTS quiz_awards(user_id TEXT NOT NULL REFERENCES users(id),question_id TEXT NOT NULL,amount INTEGER NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,question_id));
 CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),amount INTEGER NOT NULL,kind TEXT NOT NULL,detail TEXT NOT NULL,unique_key TEXT UNIQUE NOT NULL,created_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS mistakes(user_id TEXT NOT NULL REFERENCES users(id),question_id TEXT NOT NULL,last_answer TEXT NOT NULL,last_wrong TEXT NOT NULL,wrong_count INTEGER NOT NULL,reviewed INTEGER NOT NULL,updated_at INTEGER NOT NULL,PRIMARY KEY(user_id,question_id));
 CREATE TABLE IF NOT EXISTS study_days(user_id TEXT NOT NULL REFERENCES users(id),day TEXT NOT NULL,ms INTEGER NOT NULL,PRIMARY KEY(user_id,day));
 CREATE TABLE IF NOT EXISTS study_subject_days(user_id TEXT NOT NULL REFERENCES users(id),subject TEXT NOT NULL,day TEXT NOT NULL,ms INTEGER NOT NULL,PRIMARY KEY(user_id,subject,day));
 CREATE TABLE IF NOT EXISTS study_clock(user_id TEXT PRIMARY KEY REFERENCES users(id),tab_id TEXT NOT NULL,seq INTEGER NOT NULL,last_at INTEGER NOT NULL,active_until INTEGER NOT NULL,lease_until INTEGER NOT NULL,subject TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS migrations(user_id TEXT PRIMARY KEY REFERENCES users(id),legacy_id TEXT UNIQUE NOT NULL,snapshot TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'pending',created_at INTEGER NOT NULL,approved_at INTEGER);
 CREATE INDEX IF NOT EXISTS quiz_user ON quiz_sessions(user_id,created_at);
 CREATE INDEX IF NOT EXISTS ledger_user ON ledger(user_id,created_at);`);
    // Serialize schema upgrades: concurrent cold starts must not ALTER the same column twice.
    await db.transaction(async () => {
      const columns = new Set((await db.prepare('PRAGMA table_info(users)').all()).map(c => c.name));
      if (!columns.has('partner_locked')) {
        await db.exec('ALTER TABLE users ADD COLUMN partner_locked INTEGER NOT NULL DEFAULT 0');
        await db.exec("UPDATE users SET partner_locked=1 WHERE role='student'");
      }
      ;
      if (!columns.has('deleted_at')) await db.exec('ALTER TABLE users ADD COLUMN deleted_at INTEGER');
      if (!columns.has('deleted_by')) await db.exec('ALTER TABLE users ADD COLUMN deleted_by TEXT');
    });
    const run = async (sql, ...args) => await db.prepare(sql).run(...args),
      get = async (sql, ...args) => await db.prepare(sql).get(...args),
      all = async (sql, ...args) => await db.prepare(sql).all(...args);
    await run('INSERT OR IGNORE INTO classes VALUES (?,?)', 'unassigned', '미배정');
    // Preserve existing cumulative releases when upgrading to independently selected units.
    const legacyReleases = await all('SELECT * FROM releases');
    if (legacyReleases.length) await db.batch(legacyReleases.map(r => ({
      sql: 'INSERT OR IGNORE INTO release_selections VALUES (?,?,?)',
      args: [r.class_id, r.subject, json(Array.from({
        length: r.max_unit
      }, (_, i) => i + 1))]
    })));
    curriculum = await createCurriculum(db);
    await refreshContent();
    const tx = async fn => await db.transaction(fn);
    const passwordHash = (p, s) => scryptSync(p, s, 64).toString('hex');
    async function createUser({
      login,
      password,
      nickname,
      role = 'student',
      classId = 'unassigned'
    }) {
      return await db.transaction(async () => {
        login = String(login ?? '').trim().toLowerCase();
        nickname = String(nickname ?? '').trim();
        if (!/^[a-z0-9_]{3,20}$/.test(login) || nickname.length < 2 || nickname.length > 20 || typeof password !== 'string' || password.length < 8 || password.length > 128) fail(400, '아이디·이름·비밀번호 형식을 확인해 주세요.');
        if (await get('SELECT id FROM users WHERE login=?', login)) fail(409, '이미 사용 중인 아이디예요.');
        if (!['admin', 'student'].includes(role) || !(await get('SELECT id FROM classes WHERE id=?', classId))) fail(400, '계정 설정이 올바르지 않아요.');
        const id = randomUUID(),
          salt = randomBytes(24).toString('hex');
        await run('INSERT INTO users(id,login,name,role,class_id,salt,password,pet,created_at) VALUES (?,?,?,?,?,?,?,?,?)', id, login, nickname, role, classId, salt, passwordHash(password, salt), json(petDefault()), clock());
        return await get('SELECT * FROM users WHERE id=?', id);
      });
    }
    const publicUser = async u => ({
      id: u.id,
      login: u.login,
      nickname: u.name,
      role: u.role,
      classId: u.class_id,
      className: (await get('SELECT name FROM classes WHERE id=?', u.class_id))?.name ?? ''
    });
    async function login(name, password) {
      const u = await get('SELECT * FROM users WHERE login=?', String(name ?? '').trim().toLowerCase());
      const salt = u?.salt ?? 'invalid-account-salt';
      const digest = passwordHash(String(password ?? '').slice(0, 128), salt);
      if (!u || u.deleted_at != null || !timingSafeEqual(Buffer.from(digest, 'hex'), Buffer.from(u.password, 'hex'))) fail(401, '아이디 또는 비밀번호를 확인해 주세요.');
      return await newSession(u);
    }
    async function newSession(u) {
      if ((await fresh(u)).deleted_at != null) fail(401, '삭제된 계정입니다.');
      const token = randomBytes(32).toString('base64url');
      await run('DELETE FROM auth_sessions WHERE expires<?', clock());
      await run('INSERT INTO auth_sessions VALUES (?,?,?)', createHash('sha256').update(token).digest('hex'), u.id, clock() + 7 * 86400000);
      return {
        token,
        user: await publicUser(u)
      };
    }
    async function authenticate(token) {
      if (!token) return null;
      return (await get('SELECT u.* FROM users u JOIN auth_sessions s ON u.id=s.user_id WHERE s.token_hash=? AND s.expires>? AND u.deleted_at IS NULL', createHash('sha256').update(token).digest('hex'), clock())) ?? null;
    }
    async function logout(token) {
      await run('DELETE FROM auth_sessions WHERE token_hash=?', createHash('sha256').update(token ?? '').digest('hex'));
    }
    const fresh = async u => {
      const row = await get('SELECT * FROM users WHERE id=? AND deleted_at IS NULL', u.id);
      return row ?? fail(401, '로그인이 필요해요.');
    };
    const admin = u => {
      if (u.role !== 'admin') fail(403, '관리자만 접근할 수 있어요.');
    };
    const student = u => {
      if (u.role !== 'student') fail(403, '학생 계정으로 이용해 주세요.');
    };
    const selectedFor = async (classId, subject) => {
      const row = await get('SELECT units FROM release_selections WHERE class_id=? AND subject=?', classId, subject);
      if (row) return parse(row.units, []);
      const limit = (await get('SELECT max_unit FROM releases WHERE class_id=? AND subject=?', classId, subject))?.max_unit ?? 0;
      return Array.from({
        length: limit
      }, (_, i) => i + 1);
    };
    const releasedUnits = async (u, subject) => await selectedFor((await fresh(u)).class_id, subject);
    async function releasesFor(u) {
      const current = await fresh(u),
        rows = await all('SELECT subject,units FROM release_selections WHERE class_id=?', current.class_id),
        legacy = await all('SELECT subject,max_unit FROM releases WHERE class_id=?', current.class_id),
        result = Object.fromEntries(legacy.map(r => [r.subject, Array.from({
          length: r.max_unit
        }, (_, i) => i + 1)]));
      for (const row of rows) result[row.subject] = parse(row.units, []);
      return result;
    }
    async function loadQuestions(ids) {
      const missing = [...new Set(ids)].filter(id => !questionMap[id]);
      if (missing.length) await workshop.loadQuestions(missing);
    }
    async function accessFlags(u, ids) {
      await loadQuestions(ids);
      const releases = await releasesFor(u),
        roots = [...new Set(ids.map(id => questionMap[id]).filter(q => q?.postId).map(q => q.originalId))],
        published = new Set();
      for (let i = 0; i < roots.length; i += 200) {
        const chunk = roots.slice(i, i + 200),
          rows = await all('SELECT p.id FROM workshop_posts p JOIN users u ON u.id=p.author_id WHERE p.published=1 AND u.deleted_at IS NULL AND p.id IN (' + chunk.map(() => '?').join(',') + ')', ...chunk);
        for (const row of rows) published.add(row.id);
      }
      return new Map(ids.map(id => {
        const q = questionMap[id];
        return [id, !!q && (!q.postId || published.has(q.originalId)) && (q.source === 'student' && q.unit === 0 || (releases[q.subject] ?? []).includes(unitOf(q)))];
      }));
    }
    const allowed = async (u, q) => !!q && (await accessFlags(u, [q.id])).get(q.id);
    async function requireQuestion(u, id) {
      const flags = await accessFlags(u, [id]),
        q = questionMap[id];
      if (!q) fail(404, '문제를 찾을 수 없어요.');
      if (!flags.get(id)) fail(403, '아직 배우지 않은 단원입니다');
      return q;
    }
    async function checkUnit(u, subject, unit) {
      await refreshContent();
      if (!subjectMap[subject] || !Number.isInteger(unit) || unit < 1 || !subjectMap[subject]?.units.some(u => u.number === unit)) fail(400, '단원을 확인해 주세요.');
      if (!(await releasedUnits(u, subject)).includes(unit)) fail(403, '아직 배우지 않은 단원입니다');
    }
    const sanitizeQuestion = (q, answer) => {
      const output = {
        source: q.source ?? 'official',
        creatorId: q.creatorId ?? null,
        creatorName: q.creatorName ?? '관리자',
        creatorLogin: q.creatorLogin ?? '',
        originalId: q.originalId ?? q.id,
        version: q.version ?? 1,
        postId: q.postId ?? null,
        title: q.title ?? q.prompt,
        id: q.id,
        subject: q.subject,
        unit: unitOf(q),
        type: q.type,
        prompt: q.prompt
      };
      if (q.options) output.options = q.options;
      if (answer) {
        output.explanation = q.explanation;
        output.correctAnswer = correctText(q);
        if (q.type === 'multiple') output.correctOptionId = q.correctOptionId;
      }
      return output;
    };
    async function getQuiz(u, id) {
      const row = await get('SELECT * FROM quiz_sessions WHERE id=? AND user_id=?', id, u.id);
      if (!row) fail(404, '내 퀴즈를 찾을 수 없어요.');
      const ids = parse(row.ids, []),
        flags = await accessFlags(u, ids);
      for (const qid of ids) {
        if (!questionMap[qid]) fail(404, '문제를 찾을 수 없어요.');
        if (!flags.get(qid)) fail(403, '아직 배우지 않은 단원입니다');
      }
      return row;
    }
    async function quizView(row) {
      await loadQuestions(parse(row.ids, []));
      const ids = parse(row.ids, []),
        answers = parse(row.answers),
        q = questionMap[ids[row.position]];
      return {
        id: row.id,
        mode: row.mode,
        subject: row.subject,
        type: row.type,
        questionIds: ids,
        index: row.position,
        answers,
        draft: row.draft,
        done: !!row.done,
        result: parse(row.result, null),
        sources: [...new Set(ids.map(id => questionMap[id]?.source ?? 'official'))],
        startedAt: row.created_at,
        question: q ? sanitizeQuestion(q, answers[q.id]) : null
      };
    }
    async function catalog(u) {
      student(u);
      await refreshContent();
      const completionRows = await all('SELECT question_id FROM completions WHERE user_id=?', u.id);
      await loadQuestions(completionRows.map(r => r.question_id));
      const done = new Set(completionRows.flatMap(r => [r.question_id, questionMap[r.question_id]?.originalId ?? r.question_id])),
        releases = await releasesFor(u);
      return subjects.map(s => {
        const released = releases[s.id] ?? [],
          units = s.units.map(definition => {
            const number = definition.number,
              items = questions.filter(q => q.subject === s.id && unitOf(q) === number),
              locked = !released.includes(number);
            return {
              number,
              title: label(s.id, number),
              locked,
              total: items.length,
              completed: locked ? 0 : items.filter(q => done.has(q.id) || done.has(q.originalId)).length
            };
          }),
          exposed = questions.filter(q => q.subject === s.id && released.includes(unitOf(q))),
          completed = exposed.filter(q => done.has(q.id) || done.has(q.originalId)).length;
        return {
          ...s,
          maxUnit: Math.max(0, ...released),
          releasedUnits: released,
          units,
          counts: {
            multiple: exposed.filter(q => q.type === 'multiple').length,
            short: exposed.filter(q => q.type === 'short').length
          },
          total: exposed.length,
          completed,
          percent: exposed.length ? Math.round(completed / exposed.length * 100) : 0
        };
      });
    }
    async function summary(u, subject = 'all') {
      const rows = (await catalog({
          ...u,
          role: 'student'
        })).filter(s => subject === 'all' || s.id === subject),
        total = rows.reduce((a, s) => a + s.total, 0),
        completed = rows.reduce((a, s) => a + s.completed, 0);
      const time = subject === 'all' ? await get('SELECT COALESCE(SUM(ms),0) ms FROM study_days WHERE user_id=?', u.id) : await get('SELECT COALESCE(SUM(ms),0) ms FROM study_subject_days WHERE user_id=? AND subject=?', u.id, subject);
      const today = subject === 'all' ? await get('SELECT ms FROM study_days WHERE user_id=? AND day=?', u.id, kstDay(clock())) : await get('SELECT ms FROM study_subject_days WHERE user_id=? AND subject=? AND day=?', u.id, subject, kstDay(clock()));
      const rawMistakes = await all('SELECT question_id,reviewed FROM mistakes WHERE user_id=?', u.id);
      await loadQuestions(rawMistakes.map(m => m.question_id));
      const mistakes = rawMistakes.filter(m => questionMap[m.question_id] && (subject === 'all' || questionMap[m.question_id].subject === subject));
      const last = subject === 'all' ? await get('SELECT MAX(created_at) at FROM quiz_sessions WHERE user_id=?', u.id) : await get('SELECT MAX(created_at) at FROM quiz_sessions WHERE user_id=? AND subject=?', u.id, subject);
      const days = subject === 'all' ? await get('SELECT MAX(day) day FROM study_days WHERE user_id=?', u.id) : await get('SELECT MAX(day) day FROM study_subject_days WHERE user_id=? AND subject=?', u.id, subject);
      return {
        subjectTimes: await all('SELECT subject,SUM(ms) ms FROM study_subject_days WHERE user_id=? GROUP BY subject', u.id),
        subjects: rows,
        total,
        completed,
        percent: total ? Math.round(completed / total * 100) : 0,
        pending: mistakes.filter(m => !m.reviewed).length,
        todaySeconds: Math.floor((today?.ms ?? 0) / 1000),
        totalSeconds: Math.floor((time?.ms ?? 0) / 1000),
        lastStudyDate: [days?.day, last?.at ? kstDay(last.at) : null].filter(Boolean).sort().at(-1) ?? null
      };
    }
    async function state(u) {
      u = await fresh(u);
      const migration = await get('SELECT status,snapshot FROM migrations WHERE user_id=?', u.id),
        snap = parse(migration?.snapshot);
      const ledger = await all('SELECT l.*,d.source,d.creator_id,d.creator_name,d.problem_title,d.original_id,d.version,d.reason FROM ledger l LEFT JOIN ledger_details d ON d.ledger_id=l.id WHERE l.user_id=? ORDER BY l.created_at DESC LIMIT 50', u.id);
      return {
        user: await publicUser(u),
        data: {
          partnerLocked: !!u.partner_locked,
          coins: u.coins,
          pet: parse(u.pet, petDefault()),
          ...parse(u.game_state),
          records: ledger.map(r => ({
            at: r.created_at,
            coins: r.amount,
            game: r.kind,
            detail: r.detail,
            source: r.source,
            creatorId: r.creator_id,
            creatorName: r.creator_name,
            problemTitle: r.problem_title,
            originalId: r.original_id,
            version: r.version,
            reason: r.reason
          })),
          legacyMigration: migration ? {
            status: migration.status,
            coins: snap.coins ?? 0
          } : null
        }
      };
    }
    async function learningState(u) {
      student(u);
      const history = await Promise.all((await all('SELECT * FROM quiz_sessions WHERE user_id=? AND done=1 ORDER BY created_at DESC LIMIT 100', u.id)).map(async r => {
          const view = await quizView(r);
          delete view.question;
          delete view.answers;
          return view;
        })),
        result = {
          version: 2,
          activeQuiz: null,
          activeReview: null,
          mistakes: {},
          history
        };
      for (const mode of ['quiz', 'review', 'community']) {
        const r = await get('SELECT * FROM quiz_sessions WHERE user_id=? AND mode=? ORDER BY created_at DESC,rowid DESC LIMIT 1', u.id, mode);
        if (r) {
          const ids = parse(r.ids, []),
            flags = await accessFlags(u, ids);
          if (ids.every(id => flags.get(id))) result[mode === 'community' ? 'activeCommunity' : mode === 'quiz' ? 'activeQuiz' : 'activeReview'] = await quizView(r);else result[mode === 'community' ? 'communityLocked' : mode === 'quiz' ? 'quizLocked' : 'reviewLocked'] = true;
        }
      }
      const rows = await all('SELECT * FROM mistakes WHERE user_id=?', u.id),
        flags = rows.length ? await accessFlags(u, rows.map(m => m.question_id)) : new Map();
      for (const m of rows) {
        const q = questionMap[m.question_id];
        if (!q) continue;
        const entry = {
          source: q.source ?? 'official',
          creatorId: q.creatorId ?? null,
          creatorName: q.creatorName ?? '관리자',
          creatorLogin: q.creatorLogin ?? '',
          originalId: q.originalId ?? q.id,
          version: q.version ?? 1,
          postId: q.postId ?? null,
          id: q.id,
          subject: q.subject,
          unit: unitOf(q),
          wrongCount: m.wrong_count,
          reviewed: !!m.reviewed,
          updatedAt: m.updated_at,
          locked: !flags.get(q.id)
        };
        if (!entry.locked) Object.assign(entry, {
          question: q.prompt,
          lastAnswer: m.last_answer,
          lastWrongAnswer: m.last_wrong,
          correctAnswer: correctText(q),
          explanation: q.explanation
        });
        result.mistakes[q.id] = entry;
      }
      return result;
    }
    async function startQuiz(u, {
      subject,
      type = 'all',
      unit
    } = {}) {
      student(u);
      await refreshContent();
      if (!subjectMap[subject] || !['all', 'multiple', 'short'].includes(type)) fail(400, '과목과 유형을 확인해 주세요.');
      if (unit != null) await checkUnit(u, subject, unit);
      const openUnits = await releasedUnits(u, subject);
      const bank = questions.filter(q => q.subject === subject && openUnits.includes(unitOf(q)) && (unit == null || unitOf(q) === unit) && (type === 'all' || q.type === type));
      if (!bank.length) fail(403, '아직 배우지 않은 단원입니다');
      return await tx(async () => {
        const prev = await get('SELECT ids FROM quiz_sessions WHERE user_id=? AND mode=? AND subject=? ORDER BY created_at DESC,rowid DESC LIMIT 1', u.id, 'quiz', subject),
          previous = parse(prev?.ids, []);
        const draw = async (kind, n) => {
          const ids = bank.filter(q => q.type === kind).map(q => q.id),
            key = subject + '.' + kind + '.' + (unit ?? 'all'),
            stored = await get('SELECT remaining FROM pools WHERE user_id=? AND pool_key=?', u.id, key);
          let remaining = stored ? parse(stored.remaining, []) : shuffle(ids.filter(id => !previous.includes(id)));
          remaining = [...new Set(remaining)].filter(id => ids.includes(id));
          const count = Math.min(n, ids.length),
            picked = remaining.splice(0, count);
          if (picked.length < count) {
            remaining = [...shuffle(ids.filter(id => !picked.includes(id) && !previous.includes(id))), ...shuffle(ids.filter(id => !picked.includes(id) && previous.includes(id)))];
            picked.push(...remaining.splice(0, count - picked.length));
          }
          await run('INSERT INTO pools VALUES (?,?,?) ON CONFLICT(user_id,pool_key) DO UPDATE SET remaining=excluded.remaining', u.id, key, json(remaining));
          return picked;
        };
        const ids = shuffle([...(type !== 'short' ? await draw('multiple', 15) : []), ...(type !== 'multiple' ? await draw('short', 10) : [])]);
        return await insertQuiz(u, ids, subject, type, 'quiz');
      });
    }
    async function insertQuiz(u, ids, subject, type, mode) {
      const id = randomUUID();
      await run('INSERT INTO quiz_sessions(id,user_id,mode,subject,type,ids,created_at) VALUES (?,?,?,?,?,?,?)', id, u.id, mode, subject, type, json(ids), clock());
      return await quizView(await get('SELECT * FROM quiz_sessions WHERE id=?', id));
    }
    async function startReview(u, {
      ids
    } = {}) {
      student(u);
      if (!Array.isArray(ids) || !ids.length || ids.length > 700) fail(400, '복습 문제를 선택해 주세요.');
      ids = [...new Set(ids)];
      const flags = await accessFlags(u, ids),
        owned = new Set((await all('SELECT question_id FROM mistakes WHERE user_id=?', u.id)).map(r => r.question_id));
      for (const id of ids) {
        if (!questionMap[id]) fail(404, '문제를 찾을 수 없어요.');
        if (!flags.get(id)) fail(403, '아직 배우지 않은 단원입니다');
        if (!owned.has(id)) fail(404, '내 오답을 찾을 수 없어요.');
      }
      return await tx(async () => await insertQuiz(u, ids, new Set(ids.map(id => questionMap[id].subject)).size === 1 ? questionMap[ids[0]].subject : 'all', 'all', 'review'));
    }
    async function submit(u, id, body) {
      student(u);
      return await tx(async () => {
        const r = await getQuiz(u, id),
          ids = parse(r.ids, []),
          qid = ids[r.position],
          q = questionMap[qid],
          answers = parse(r.answers);
        if (body.questionId !== qid) fail(409, '현재 문제를 다시 확인해 주세요.');
        if (answers[qid]) return {
          session: await quizView(r),
          awarded: 0
        };
        if (r.done) fail(409, '이미 완료된 퀴즈예요.');
        const answer = String(body.answer ?? '');
        if (!answer.trim() || answer.length > 200 || q.type === 'multiple' && !q.options.some(o => o.id === answer)) fail(400, '답안을 입력하거나 선택해 주세요.');
        const correct = isCorrect(q, answer),
          now = clock();
        let awarded = 0;
        answers[qid] = {
          answer,
          answerText: answerText(q, answer),
          correct,
          at: now
        };
        if (correct) {
          if (q.source !== 'student') await run('INSERT OR IGNORE INTO completions VALUES (?,?,?)', u.id, qid, now);
          awarded = await workshop.grant(u, q, now);
          await run('UPDATE mistakes SET reviewed=1,last_answer=?,updated_at=? WHERE user_id=? AND question_id=?', answerText(q, answer), now, u.id, qid);
        } else await run('INSERT INTO mistakes VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id,question_id) DO UPDATE SET last_answer=excluded.last_answer,last_wrong=excluded.last_wrong,wrong_count=mistakes.wrong_count+1,reviewed=0,updated_at=excluded.updated_at', u.id, qid, answerText(q, answer), answerText(q, answer), 1, 0, now);
        answers[qid].awarded = awarded;
        await run('UPDATE quiz_sessions SET answers=?,draft=? WHERE id=?', json(answers), answer, id);
        return {
          session: await quizView(await get('SELECT * FROM quiz_sessions WHERE id=?', id)),
          awarded
        };
      });
    }
    async function next(u, id) {
      student(u);
      return await tx(async () => {
        const r = await getQuiz(u, id);
        if (r.done) return await quizView(r);
        const ids = parse(r.ids, []),
          answers = parse(r.answers);
        if (!answers[ids[r.position]]) fail(400, '현재 답안을 먼저 제출해 주세요.');
        if (r.position < ids.length - 1) await run('UPDATE quiz_sessions SET position=position+1,draft=? WHERE id=?', '', id);else {
          const entries = Object.values(answers),
            correct = entries.filter(a => a.correct).length,
            result = {
              correct,
              wrong: ids.length - correct,
              total: ids.length,
              score: Math.round(correct / ids.length * 100),
              coins: entries.reduce((sum, a) => sum + (a.awarded ?? 0), 0),
              finishedAt: clock()
            };
          await run('UPDATE quiz_sessions SET done=1,result=? WHERE id=?', json(result), id);
        }
        return await quizView(await get('SELECT * FROM quiz_sessions WHERE id=?', id));
      });
    }
    async function draft(u, id, value) {
      const r = await getQuiz(u, id);
      if (r.done) return;
      const ids = parse(r.ids, []);
      if (!parse(r.answers)[ids[r.position]]) await run('UPDATE quiz_sessions SET draft=? WHERE id=?', String(value ?? '').slice(0, 200), id);
    }
    async function lesson(u, subject, unit) {
      student(u);
      await checkUnit(u, subject, unit);
      const done = new Set((await all('SELECT question_id FROM completions WHERE user_id=?', u.id)).map(r => r.question_id));
      return {
        subject,
        unit,
        title: label(subject, unit),
        items: questions.filter(q => q.subject === subject && unitOf(q) === unit).map(q => ({
          id: q.id,
          title: q.prompt,
          explanation: q.explanation,
          completed: done.has(q.id) || done.has(q.originalId)
        })),
        source: subjectMap[subject].source
      };
    }
    async function complete(u, id) {
      student(u);
      const q = await requireQuestion(u, id);
      if (q.source === 'student') fail(403, '공식 문제만 학습 진도에 포함됩니다.');
      await run('INSERT OR IGNORE INTO completions VALUES (?,?,?)', u.id, q.id, clock());
    }
    async function updateProfile(u, {
      nickname,
      character
    }) {
      return await tx(async () => {
        u = await fresh(u);
        if (nickname != null) {
          nickname = String(nickname).trim();
          if (nickname.length < 2 || nickname.length > 20) fail(400, '닉네임은 2~20자로 입력해 주세요.');
        }
        if (character != null) {
          student(u);
          if (!['piplup', 'squirtle', 'gengar', 'bulbasaur'].includes(character)) fail(400, '캐릭터를 확인해 주세요.');
          const pet = parse(u.pet);
          if (u.partner_locked && pet.character !== character) {
            if (u.coins < 5000) fail(400, '파트너 변경에는 5,000포인트가 필요해요.');
            await run('UPDATE users SET coins=coins-5000 WHERE id=?', u.id);
            await run('INSERT INTO ledger VALUES (?,?,?,?,?,?,?)', randomUUID(), u.id, -5000, '파트너 변경', pet.character + ' → ' + character, randomUUID(), clock());
          }
          if (!u.partner_locked || pet.character !== character) {
            pet.character = character;
            await run('UPDATE users SET pet=?,partner_locked=1 WHERE id=?', json(pet), u.id);
          }
        }
        if (nickname != null) await run('UPDATE users SET name=? WHERE id=?', nickname, u.id);
        return await state(u);
      });
    }
    async function petAction(u, {
      action,
      item
    }) {
      student(u);
      return await tx(async () => {
        u = await fresh(u);
        const p = parse(u.pet),
          hours = Math.max(0, (clock() - p.last) / 3600000);
        p.hunger = Math.max(0, p.hunger - hours * 3);
        p.happy = Math.max(0, p.happy - hours * 2);
        p.last = clock();
        let cost = 0;
        if (action === 'food' || action === 'play') {
          const field = action === 'food' ? 'hunger' : 'happy';
          if (p[field] >= 100) fail(400, '이미 충분해요!');
          cost = action === 'food' ? 10 : 5;
          p[field] = Math.min(100, p[field] + 25);
          p.xp += action === 'food' ? 15 : 10;
        } else if (action === 'wear') {
          const price = itemMap[item]?.price;
          if (!price) fail(400, '꾸미기를 확인해 주세요.');
          if (!p.owned.includes(item)) {
            cost = price;
            p.owned.push(item);
          }
          p.wear = item;
        } else if (action === 'remove') p.wear = '';else if (action !== 'age') fail(400, '행동을 확인해 주세요.');
        if (u.coins < cost) fail(400, '코인이 부족해요. 퀴즈로 코인을 모아 주세요.');
        await run('UPDATE users SET coins=coins-?,pet=? WHERE id=?', cost, json(p), u.id);
        if (cost) await run('INSERT INTO ledger VALUES (?,?,?,?,?,?,?)', randomUUID(), u.id, -cost, '펫 돌보기', action, randomUUID(), clock());
        return await state(u);
      });
    }
    async function saveGame(u, body) {
      student(u);
      const data = {};
      for (const key of ['card', 'metro']) if (key in body) data[key] = body[key];
      if (json(data).length > 50000) fail(400, '게임 데이터가 너무 커요.');
      const old = parse((await fresh(u)).game_state);
      await run('UPDATE users SET game_state=? WHERE id=?', json({
        ...old,
        ...data
      }), u.id);
    }
    async function addTime(userId, subject, start, end, source = 'official') {
      while (start < end) {
        const boundary = (Math.floor((start + 9 * 3600000) / 86400000) + 1) * 86400000 - 9 * 3600000,
          until = Math.min(end, boundary),
          day = kstDay(start),
          ms = Math.floor(until - start);
        await run('INSERT INTO study_days VALUES (?,?,?) ON CONFLICT(user_id,day) DO UPDATE SET ms=ms+excluded.ms', userId, day, ms);
        await run('INSERT INTO study_subject_days VALUES (?,?,?,?) ON CONFLICT(user_id,subject,day) DO UPDATE SET ms=ms+excluded.ms', userId, subject, day, ms);
        await run('INSERT INTO study_source_days VALUES(?,?,?,?) ON CONFLICT(user_id,source,day) DO UPDATE SET ms=ms+excluded.ms', userId, source, day, ms);
        await run('INSERT INTO study_source_subject_days VALUES(?,?,?,?,?) ON CONFLICT(user_id,source,subject,day) DO UPDATE SET ms=ms+excluded.ms', userId, source, subject, day, ms);
        start = until;
      }
    }
    async function heartbeat(u, body) {
      student(u);
      const {
        tabId,
        seq,
        visible,
        context
      } = body;
      if (typeof tabId !== 'string' || tabId.length > 80 || !Number.isInteger(seq) || seq < 0) fail(400, '활동 정보를 확인해 주세요.');
      return await tx(async () => {
        const now = clock(),
          old = await get('SELECT * FROM study_clock WHERE user_id=?', u.id);
        if (old?.tab_id === tabId && seq <= old.seq) return {
          owner: true,
          addedMs: 0
        };
        if (old && old.tab_id !== tabId && old.lease_until > now) return {
          owner: false,
          addedMs: 0
        };
        let subject = null,
          permitted = false,
          source = 'official';
        if (context?.kind === 'lesson') {
          await checkUnit(u, context.subject, Number(context.unit));
          subject = context.subject;
          permitted = true;
        } else if (context?.kind === 'quiz' || context?.kind === 'review' || context?.kind === 'community') {
          const r = await getQuiz(u, context.sessionId);
          if (r.mode !== context.kind || r.done) permitted = false;else {
            const q = questionMap[parse(r.ids, [])[r.position]];
            subject = q.subject;
            source = q.source ?? 'official';
            permitted = true;
          }
        } else if (visible) fail(400, '학습 화면에서만 시간을 집계해요.');
        const age = Number(body.activityAgeMs);
        const active = visible === true && permitted && Number.isFinite(age) && age >= 0 && age < 300000;
        let addedMs = 0;
        if (old?.tab_id === tabId && now >= old.last_at && now - old.last_at <= 30000) {
          const end = Math.min(now, old.active_until, old.lease_until);
          if (end > old.last_at) {
            addedMs = end - old.last_at;
            await addTime(u.id, old.subject, old.last_at, end, (await get('SELECT source FROM study_clock_source WHERE user_id=?', u.id))?.source ?? 'official');
          }
        }
        const until = active ? now + Math.max(0, 300000 - age) : now;
        await run('INSERT INTO study_clock VALUES (?,?,?,?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET tab_id=excluded.tab_id,seq=excluded.seq,last_at=excluded.last_at,active_until=excluded.active_until,lease_until=excluded.lease_until,subject=excluded.subject', u.id, tabId, seq, now, until, active ? now + 30000 : now, subject ?? old?.subject ?? 'vue');
        await run('INSERT INTO study_clock_source VALUES(?,?) ON CONFLICT(user_id) DO UPDATE SET source=excluded.source', u.id, source);
        return {
          owner: active,
          addedMs,
          todaySeconds: Math.floor(((await get('SELECT ms FROM study_days WHERE user_id=? AND day=?', u.id, kstDay(now)))?.ms ?? 0) / 1000)
        };
      });
    }
    async function migration(u, body) {
      return await db.transaction(async () => {
        student(u);
        const snapshot = body?.progress,
          legacyId = String(body?.legacyId ?? '');
        if (!snapshot || !legacyId || legacyId.length > 100 || !Number.isSafeInteger(snapshot.coins) || snapshot.coins < 0 || snapshot.coins > 100000000 || json(snapshot).length > 1500000) fail(400, '기존 기록을 확인해 주세요.');
        if (await get('SELECT user_id FROM migrations WHERE legacy_id=? OR user_id=?', legacyId, u.id)) return await state(u);
        await run('INSERT INTO migrations(user_id,legacy_id,snapshot,created_at) VALUES (?,?,?,?)', u.id, legacyId, json(snapshot), clock());
        await run('UPDATE users SET partner_locked=1 WHERE id=?', u.id);
        return await state(u);
      });
    }
    async function approveMigration(u, id) {
      admin(u);
      return await tx(async () => {
        const m = await get('SELECT * FROM migrations WHERE user_id=?', id);
        if (!m) fail(404, '이전 요청이 없어요.');
        if (m.status === 'approved') return;
        const snap = parse(m.snapshot),
          coins = snap.coins;
        await run('UPDATE users SET coins=coins+? WHERE id=?', coins, id);
        await run('INSERT INTO ledger VALUES (?,?,?,?,?,?,?)', randomUUID(), id, coins, '기존 코인 이전', '관리자 승인', id + ':migration', clock());
        if (snap.pet) {
          const p = {
            ...petDefault(),
            ...snap.pet
          };
          p.xp = Math.max(0, Number(p.xp) || 0);
          p.owned = Array.isArray(p.owned) ? p.owned.filter(x => Object.hasOwn(itemMap, x)) : [];
          await run('UPDATE users SET pet=?,game_state=? WHERE id=?', json(p), json({
            card: snap.card ?? null,
            metro: snap.metro ?? null
          }), id);
        }
        const imports = [];
        for (const h of snap.learning?.history ?? []) for (const [qid, a] of Object.entries(h.answers ?? {})) if (questionMap[qid] && a.correct) {
          imports.push({
            sql: 'INSERT OR IGNORE INTO completions VALUES (?,?,?)',
            args: [id, qid, clock()]
          });
          if (h.mode !== 'review') imports.push({
            sql: 'INSERT OR IGNORE INTO quiz_awards VALUES (?,?,?,?)',
            args: [id, qid, 0, clock()]
          });
        }
        for (const [qid, m] of Object.entries(snap.learning?.mistakes ?? {})) if (questionMap[qid]) imports.push({
          sql: 'INSERT OR IGNORE INTO mistakes VALUES (?,?,?,?,?,?,?)',
          args: [id, qid, String(m.lastAnswer ?? '').slice(0, 500), String(m.lastWrongAnswer ?? m.lastAnswer ?? '').slice(0, 500), Math.max(1, Math.floor(Number(m.wrongCount) || 1)), m.reviewed ? 1 : 0, Number(m.updatedAt) || clock()]
        });
        for (let offset = 0; offset < imports.length; offset += 200) await db.batch(imports.slice(offset, offset + 200));
        await run('UPDATE migrations SET status=?,approved_at=? WHERE user_id=?', 'approved', clock(), id);
      });
    }
    async function adminData(u, filters = {}) {
      admin(u);
      await refreshContent();
      return {
        classes: await all('SELECT * FROM classes ORDER BY name'),
        subjects,
        students: await Promise.all((await all("SELECT * FROM users WHERE role='student' AND deleted_at IS NULL ORDER BY name")).filter(s => (!filters.classId || s.class_id === filters.classId) && (!filters.search || (s.name + ' ' + s.login).toLowerCase().includes(filters.search.toLowerCase()))).map(async s => ({
          ...(await publicUser(s)),
          ...(await summary(s, filters.subject ?? 'all')),
          sourceStats: await workshop.analytics(u, 'all', s.id, filters)
        }))),
        releases: await Promise.all((await all('SELECT * FROM releases')).map(async r => ({
          ...r,
          units: await selectedFor(r.class_id, r.subject)
        }))),
        migrations: (await all('SELECT m.user_id,m.status,m.created_at,m.snapshot,u.name,u.login FROM migrations m JOIN users u ON u.id=m.user_id WHERE u.deleted_at IS NULL')).map(m => ({
          ...m,
          snapshot: undefined,
          claimedCoins: parse(m.snapshot).coins
        }))
      };
    }
    async function studentDetail(u, id) {
      admin(u);
      const s = await get("SELECT * FROM users WHERE id=? AND role='student' AND deleted_at IS NULL", id);
      if (!s) fail(404, '학생을 찾을 수 없어요.');
      const m = await get('SELECT * FROM migrations WHERE user_id=?', id);
      return {
        user: await publicUser(s),
        ...(await summary(s)),
        history: await Promise.all((await all('SELECT * FROM quiz_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 100', id)).map(quizView)),
        mistakes: (await all('SELECT * FROM mistakes WHERE user_id=?', id)).map(m => ({
          ...m,
          source: questionMap[m.question_id]?.source ?? 'official',
          creatorName: questionMap[m.question_id]?.creatorName ?? '관리자',
          creatorId: questionMap[m.question_id]?.creatorId,
          postId: questionMap[m.question_id]?.postId,
          question: questionMap[m.question_id]?.prompt,
          subject: questionMap[m.question_id]?.subject,
          correctAnswer: questionMap[m.question_id] ? correctText(questionMap[m.question_id]) : ''
        })),
        studyDays: await all('SELECT * FROM study_days WHERE user_id=? ORDER BY day DESC LIMIT 60', id),
        subjectTimes: await all('SELECT subject,SUM(ms) ms FROM study_subject_days WHERE user_id=? GROUP BY subject', id),
        migration: m ? {
          status: m.status,
          snapshot: parse(m.snapshot)
        } : null
      };
    }
    async function deleteStudent(u, id, body) {
      admin(u);
      return await tx(async () => {
        const target = await get('SELECT * FROM users WHERE id=?', id);
        if (!target) fail(404, '학생을 찾을 수 없어요.');
        if (target.role !== 'student' || id === u.id) fail(403, '학생 계정만 삭제할 수 있어요.');
        if (body?.confirmLogin !== target.login) fail(400, '삭제할 학생 아이디를 정확하게 입력해 주세요.');
        if (target.deleted_at == null) await run('UPDATE users SET deleted_at=?,deleted_by=? WHERE id=?', clock(), u.id, id);
        await run('DELETE FROM auth_sessions WHERE user_id=?', id);
        await run('DELETE FROM study_clock WHERE user_id=?', id);
        return {
          ok: true
        };
      });
    }
    async function createClass(u, name) {
      admin(u);
      name = String(name ?? '').trim();
      if (!name || name.length > 40) fail(400, '기수 이름을 확인해 주세요.');
      const id = randomUUID();
      try {
        await run('INSERT INTO classes VALUES (?,?)', id, name);
      } catch {
        fail(409, '이미 있는 기수 이름이에요.');
      }
      return {
        id,
        name
      };
    }
    async function assignClass(u, id, classId) {
      admin(u);
      if (!(await get('SELECT id FROM classes WHERE id=?', classId))) fail(400, '기수를 확인해 주세요.');
      if (!(await get("SELECT id FROM users WHERE id=? AND role='student'", id))) fail(404, '학생을 찾을 수 없어요.');
      await run('UPDATE users SET class_id=? WHERE id=?', classId, id);
      await run('DELETE FROM study_clock WHERE user_id=?', id);
    }
    async function release(u, body) {
      admin(u);
      const {
        classId,
        subject
      } = body;
      await refreshContent();
      let units;
      if (Object.hasOwn(body, 'units')) {
        if (!Array.isArray(body.units) || body.units.length > 200 || body.units.some(n => !Number.isInteger(n) || !subjectMap[subject]?.units.some(u => u.number === n))) fail(400, '공개할 학습 항목을 확인해 주세요.');
        units = [...new Set(body.units)].sort((a, b) => a - b);
      } else {
        const n = body.maxUnit;
        if (!Number.isInteger(n) || n < 0 || n > 5) fail(400, '진도 설정을 확인해 주세요.');
        units = Array.from({
          length: n
        }, (_, i) => i + 1);
      }
      if (!(await get('SELECT id FROM classes WHERE id=?', classId)) || !subjectMap[subject]) fail(400, '기수와 과목을 확인해 주세요.');
      await tx(async () => {
        await run('INSERT INTO releases VALUES (?,?,?) ON CONFLICT(class_id,subject) DO UPDATE SET max_unit=excluded.max_unit', classId, subject, Math.min(5, Math.max(0, ...units)));
        await run('INSERT INTO release_selections VALUES (?,?,?) ON CONFLICT(class_id,subject) DO UPDATE SET units=excluded.units', classId, subject, json(units));
        await run('DELETE FROM study_clock WHERE user_id IN (SELECT id FROM users WHERE class_id=?)', classId);
      });
    }
    const api = {
      db,
      createUser,
      newSession,
      login,
      logout,
      authenticate,
      publicUser,
      admin,
      student,
      state,
      catalog,
      summary,
      learningState,
      startQuiz,
      startReview,
      getQuiz,
      quizView,
      submit,
      next,
      draft,
      lesson,
      complete,
      updateProfile,
      petAction,
      saveGame,
      heartbeat,
      migration,
      approveMigration,
      adminData,
      studentDetail,
      deleteStudent,
      createClass,
      assignClass,
      release,
      close: async () => await db.close()
    };
    api.curriculum = async () => await refreshContent();
    api.addCurriculum = (u, b) => curriculum.add(u, b);
    workshop = await createWorkshop(api, {
      clock,
      questionMap,
      officialQuestions: questions,
      insertQuiz,
      allowed
    });
    api.workshop = workshop;
    api.points = await createAdminPoints(api,{clock});
    return api;
  } catch (error) {
    await db.close();
    throw error;
  }
}
