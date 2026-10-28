import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { createService } from '../server/service.mjs';
import { databaseConfig, openDatabase } from '../server/database.mjs';
import { questionMap } from '../server/questions/index.js';
if (process.argv[2] === 'worker') {
  const [,,, file, user, quiz, qid] = process.argv,
    s = await createService(file);
  try {
    const u = await s.db.prepare('SELECT * FROM users WHERE id=?').get(user);
    await s.submit(u, quiz, {
      questionId: qid,
      answer: questionMap[qid].correctOptionId
    });
    console.log('worker ok');
  } finally {
    await s.close();
  }
} else {
  assert.throws(() => databaseConfig(undefined, {
    NODE_ENV: 'production'
  }), /required/);
  assert.throws(() => databaseConfig(undefined, {
    RENDER: 'true',
    SPOKEMON_DB: 'ignored.sqlite'
  }), /fallback is disabled/);
  assert.throws(() => databaseConfig(undefined, {
    TURSO_DATABASE_URL: 'libsql://example.turso.io'
  }), /TOKEN/);
  assert.throws(() => databaseConfig(undefined, {
    TURSO_DATABASE_URL: 'file:secret',
    TURSO_AUTH_TOKEN: 'test'
  }), /remote/);
  const cfg = databaseConfig(undefined, {
    TURSO_DATABASE_URL: 'libsql://example.turso.io',
    TURSO_AUTH_TOKEN: 'test'
  });
  assert.equal(cfg.authToken, 'test');
  assert.equal(cfg.intMode, 'number');
  const file = join(mkdtempSync(join(tmpdir(), 'spokemon-turso-')), 'app.sqlite'),
    a = await createService(file),
    b = await createService(file);
  try {
    const admin = await a.createUser({
        login: 'turso_admin',
        nickname: '관리자',
        password: 'test-only-pass',
        role: 'admin'
      }),
      u = await a.createUser({
        login: 'turso_student',
        nickname: '학생',
        password: 'test-only-pass'
      });
    await a.release(admin, {
      classId: 'unassigned',
      subject: 'vue',
      units: [1]
    });
    const login = await a.login(u.login, 'test-only-pass');
    assert.equal((await b.authenticate(login.token)).id, u.id);
    const content = {
      subject: 'vue',
      unit: 1,
      title: '원격 캐시 검증',
      prompt: '반응형 API 이름은?',
      type: 'short',
      acceptedAnswers: ['ref'],
      explanation: 'ref는 반응형 참조예요.',
      published: true,
      reviewed: true
    };
    const post = await a.workshop.save(u, content),
      quiz = await a.workshop.start(u, post.id),
      view = await b.quizView(await b.getQuiz(u, quiz.id));
    assert.equal(view.question.prompt, content.prompt);
    assert.equal(view.question.source, 'student');
    assert.equal(view.question.creatorLogin, u.login);
    assert(!('acceptedAnswers' in view.question));
    await b.release(admin, {
      classId: 'unassigned',
      subject: 'vue',
      units: []
    });
    await assert.rejects(a.submit(u, quiz.id, {
      questionId: quiz.question.id,
      answer: 'ref'
    }), e => e.status === 403);
    await a.release(admin, {
      classId: 'unassigned',
      subject: 'vue',
      units: [1]
    });
    await assert.rejects(a.db.transaction(async () => {
      await a.db.prepare('UPDATE users SET coins=coins+77 WHERE id=?').run(u.id);
      await a.db.transaction(async () => {
        await a.db.prepare('UPDATE users SET coins=coins+9 WHERE id=?').run(u.id);
      });
      throw Error('rollback');
    }), /rollback/);
    assert.equal((await b.db.prepare('SELECT coins FROM users WHERE id=?').get(u.id)).coins, 0);
    // Independent processes have no shared JS mutex. The database transaction/unique keys must protect rewards.
    const q = Object.values(questionMap).find(q => q.subject === 'vue' && q.type === 'multiple'),
      ids = Array.from({
        length: 4
      }, () => randomUUID());
    await a.db.batch(ids.map(id => ({
      sql: 'INSERT INTO quiz_sessions(id,user_id,mode,subject,type,ids,created_at) VALUES(?,?,?,?,?,?,?)',
      args: [id, u.id, 'quiz', 'vue', 'multiple', JSON.stringify([q.id]), Date.now()]
    })));
    async function worker(id) {
      const p = spawn(process.execPath, ['scripts/verify-turso.mjs', 'worker', file, u.id, id, q.id], {
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe']
      });
      let out = '';
      p.stdout.on('data', b => out += b);
      p.stderr.on('data', b => out += b);
      const code = await new Promise(r => p.on('exit', r));
      assert.equal(code, 0, out);
    }
    await Promise.all(ids.map(worker));
    assert.equal((await a.db.prepare('SELECT coins FROM users WHERE id=?').get(u.id)).coins, 20);
    assert.equal((await a.db.prepare('SELECT COUNT(*) n FROM quiz_awards WHERE user_id=?').get(u.id)).n, 1);
    assert.equal((await a.db.prepare('SELECT COUNT(*) n FROM ledger WHERE user_id=?').get(u.id)).n, 1);
    // Validate the async batch's daily quota atomically (not one stale count per parallel item).
    const batch = await a.workshop.saveBatch(u, {
      requestKey: 'turso-batch-18',
      questions: Array.from({
        length: 18
      }, () => content)
    });
    assert.equal(batch.items.length, 18);
    await assert.rejects(a.workshop.saveBatch(u, {
      requestKey: 'turso-batch-over',
      questions: [content, content]
    }), e => e.status === 429);
    assert.equal((await a.db.prepare('SELECT COUNT(*) n FROM workshop_posts WHERE author_id=?').get(u.id)).n, 19);
    assert.equal((await a.workshop.saveBatch(u, {
      requestKey: 'turso-batch-18',
      questions: Array.from({
        length: 18
      }, () => content)
    })).items.length, 18);
    const yaml = readFileSync('render.yaml', 'utf8');
    assert.match(yaml, /plan: free/);
    assert(!/disk:|SPOKEMON_DB/.test(yaml));
    assert.match(yaml, /TURSO_AUTH_TOKEN/);
    for (const file of ['service', 'mail', 'social', 'notes', 'presence', 'workshop', 'http', 'index']) assert(!readFileSync('server/' + file + '.mjs', 'utf8').includes('node:sqlite'));
    console.log('PASS: libSQL async adapter, production env-only configuration, rollback/nesting, two-client session/cache/lock behavior, FOUR independent processes reward once, batch quota+idempotency, Render Free configuration.');
  } finally {
    await a.close();
    await b.close();
  }
}
