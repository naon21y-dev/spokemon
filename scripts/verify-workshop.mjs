import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
import { questionMap } from '../server/questions/index.js';
const filename = join(mkdtempSync(join(tmpdir(), 'spokemon-workshop-')), 'test.sqlite');
let now = Date.UTC(2026, 9, 27, 14, 59, 30),
  s = await createService(filename, {
    clock: () => now
  });
const password = 'test-only-pass',
  admin = await s.createUser({
    login: 'maker_admin',
    nickname: '관리자',
    password,
    role: 'admin'
  }),
  author = await s.createUser({
    login: 'maker_student',
    nickname: '제작자',
    password
  }),
  user = await s.createUser({
    login: 'solver_student',
    nickname: '풀이학생',
    password
  }),
  other = await s.createUser({
    login: 'locked_student',
    nickname: '잠긴학생',
    password,
    classId: (await s.createClass(admin, '잠긴 기수')).id
  });
await s.release(admin, {
  classId: 'unassigned',
  subject: 'vue',
  units: [1]
});
const body = {
  subject: 'vue',
  unit: 1,
  type: 'multiple',
  title: '반응성 기초',
  prompt: 'Vue의 반응형 참조를 만드는 함수는?',
  options: ['ref', 'log', 'fetch', 'alert'].map((text, i) => ({
    id: 'choice-' + i,
    text
  })),
  correctOptionId: 'choice-0',
  explanation: 'ref는 반응형 참조를 생성합니다.',
  published: true,
  reviewed: true
};
async function post(title = body.title) {
  return await s.workshop.save(author, {
    ...body,
    title
  });
}
async function solve(u, id, answer = 'choice-0') {
  const q = await s.workshop.start(u, id);
  return await s.submit(u, q.id, {
    questionId: q.question.id,
    answer
  });
}
const first = await post();
await assert.rejects(async () => await s.workshop.save(user, {
  ...body,
  baseVersion: 1
}, first.id), e => e.status === 403);
await assert.rejects(async () => await s.workshop.settings(user, {
  official: 1,
  student: 1,
  dailyCap: 10
}), e => e.status === 403);
await assert.rejects(async () => await s.workshop.detail(other, first.id, true), e => e.status === 403);
await assert.rejects(async () => await s.workshop.start(other, first.id), e => e.status === 403);
assert.ok((await s.workshop.list(other)).items[0].locked);
const publicView = await s.workshop.detail(user, first.id);
assert.ok(!('correctOptionId' in publicView) && !('acceptedAnswers' in publicView) && !('explanation' in publicView));
assert.equal(publicView.source, 'student');
assert.equal((await solve(author, first.id)).awarded, 0);
assert.equal((await solve(user, first.id, 'choice-1')).awarded, 0);
assert.equal((await s.learningState(user)).mistakes[publicView.id].wrongCount, 1);
assert.equal((await solve(user, first.id)).awarded, 10);
assert.equal((await s.learningState(user)).mistakes[publicView.id].reviewed, true);
assert.equal((await solve(user, first.id)).awarded, 0);
const revision = await s.workshop.save(author, {
  ...body,
  baseVersion: 1,
  title: '새 버전 제목'
}, first.id);
assert.equal(revision.version, 2);
assert.equal((await s.workshop.detail(user, first.id)).originalId, first.id);
assert.equal((await solve(user, first.id)).awarded, 0);
await assert.rejects(async () => await s.workshop.save(author, {
  ...body,
  baseVersion: 1
}, first.id), e => e.status === 409);
assert.equal((await s.catalog(user)).find(q => q.id === 'vue').completed, 0);
await s.workshop.settings(admin, {
  official: 7,
  student: 10,
  dailyCap: 15
});
const second = await post('한도 일부 지급');
assert.equal((await solve(user, second.id)).awarded, 5);
const third = await post('내일 재도전');
assert.equal((await solve(user, third.id)).awarded, 0);
now += 60000;
assert.equal((await solve(user, third.id)).awarded, 10);
assert.equal((await s.db.prepare('SELECT count(*) n FROM quiz_awards WHERE user_id=? AND question_id=?').get(user.id, first.id)).n, 1);
const q = await s.startQuiz(user, {
    subject: 'vue',
    type: 'multiple'
  }),
  official = questionMap[q.question.id];
assert.equal(q.question.source, 'official');
assert.equal((await s.submit(user, q.id, {
  questionId: official.id,
  answer: official.correctOptionId
})).awarded, 7);
const officialCount = (await s.catalog(user)).find(q => q.id === 'vue').completed;
assert.equal(officialCount, 1);
assert.ok((await s.state(user)).data.records.find(r => r.source === 'student' && r.creatorId === author.id && r.problemTitle && r.reason));
assert.equal((await s.workshop.analytics(user, 'student')).selected.solved, 7);
assert.equal((await s.workshop.analytics(user, 'official')).selected.solved, 1);
await assert.rejects(async () => await s.workshop.analytics(user, 'all', author.id), e => e.status === 403);
const study = await s.workshop.start(user, third.id),
  heartbeat = async (seq, context, visible = true) => await s.heartbeat(user, {
    tabId: 'workshop-tab',
    seq,
    visible,
    context,
    activityAgeMs: 0
  });
await heartbeat(1, {
  kind: 'community',
  sessionId: study.id
});
now += 10000;
assert.equal((await heartbeat(2, {
  kind: 'community',
  sessionId: study.id
})).addedMs, 10000);
now += 10000;
await heartbeat(3, {
  kind: 'quiz',
  sessionId: q.id
});
now += 10000;
await heartbeat(4, {
  kind: 'quiz',
  sessionId: q.id
}, false);
let stats = await s.workshop.analytics(user);
assert.equal(stats.time.totalSeconds, 30);
assert.equal(stats.time.studentSeconds, 20);
assert.equal(stats.time.officialSeconds, 10);
assert.equal((await s.workshop.analytics(admin, 'student', user.id, {
  subject: 'vue'
})).time.studentSeconds, 20);
await s.workshop.moderate(admin, third.id, false);
await assert.rejects(async () => await s.workshop.start(user, third.id), e => e.status === 404);
await s.workshop.moderate(admin, third.id, true);
await s.release(admin, {
  classId: 'unassigned',
  subject: 'vue',
  units: []
});
await assert.rejects(async () => await s.workshop.detail(author, first.id, true), e => e.status === 403);
await assert.rejects(async () => await s.workshop.start(user, first.id), e => e.status === 403);
assert.equal((await s.learningState(user)).mistakes[publicView.id].locked, true);
await s.release(admin, {
  classId: 'unassigned',
  subject: 'vue',
  units: [1]
});
const fourth = await post('동시 요청 문제'),
  sessions = await Promise.all(Array.from({
    length: 12
  }, async () => await s.workshop.start(user, fourth.id))),
  server = await createHttp(s);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port,
  cookie = 'spokemon_session=' + (await s.newSession(user)).token;
try {
  await s.workshop.settings(admin, {
    official: 7,
    student: 12,
    dailyCap: 100
  });
  const results = await Promise.all(sessions.flatMap(session => [1, 2].map(() => fetch(base + '/api/quiz/' + session.id + '/submit', {
    method: 'POST',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-Spokemon-Request': '1'
    },
    body: JSON.stringify({
      questionId: session.question.id,
      answer: 'choice-0'
    })
  }).then(r => r.json()))));
  assert.equal(results.reduce((n, r) => n + r.awarded, 0), 12);
  assert.equal((await s.db.prepare('SELECT count(*) n FROM quiz_awards WHERE user_id=? AND question_id=?').get(user.id, fourth.id)).n, 1);
  const config = await fetch(base + '/api/admin/reward-settings', {
    method: 'PUT',
    headers: {
      Cookie: cookie,
      'Content-Type': 'application/json',
      'X-Spokemon-Request': '1'
    },
    body: JSON.stringify({
      official: 999,
      student: 999,
      dailyCap: 999
    })
  });
  assert.equal(config.status, 403);
} finally {
  await new Promise(async r => await server.close(r));
}
const short = await s.workshop.save(author, {
  ...body,
  title: '주관식 허용 정답',
  type: 'short',
  acceptedAnswers: ['ref', 'vue ref'],
  source: 'official',
  creatorId: user.id,
  originalId: first.id
});
const shortSession = await s.workshop.start(user, short.id);
assert.equal(shortSession.question.source, 'student');
assert.equal(shortSession.question.creatorId, author.id);
assert.notEqual(shortSession.question.originalId, first.id);
assert.equal((await s.submit(user, shortSession.id, {
  questionId: shortSession.question.id,
  answer: '  ReF  '
})).awarded, 12);
const balance = (await s.state(user)).data.coins;
await s.close();
s = await createService(filename, {
  clock: () => now
});
assert.equal((await s.workshop.detail(user, first.id)).version, 2);
assert.equal((await solve(user, first.id)).awarded, 0);
assert.equal((await s.state(user)).data.coins, balance);
assert.equal((await s.workshop.settings()).official, 7);
assert.equal((await s.workshop.analytics(user)).time.studentSeconds, 20);
await s.close();
console.log('PASS: authorship/source/version, locked direct APIs, no answer leaks, self no award, wrong/retry, original+revision dedupe, KST daily cap/partial/day rollover, settings, 24 concurrent submissions once, official progress isolation, source stats/time, moderation, SQLite restart persistence.');
