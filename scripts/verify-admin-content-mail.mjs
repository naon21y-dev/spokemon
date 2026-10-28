import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
const file = join(mkdtempSync(join(tmpdir(), 'spokemon-admin-content-')), 'test.sqlite'),
  s = await createService(file),
  password = 'test-only-pass';
const admin = await s.createUser({
    login: 'content_teacher',
    nickname: '관리선생님',
    password,
    role: 'admin'
  }),
  student = await s.createUser({
    login: 'content_student',
    nickname: '학습학생',
    password
  }),
  other = await s.createUser({
    login: 'content_other',
    nickname: '다른학생',
    password
  });
const origins = ['http://test.local'],
  server = await createHttp(s, {
    origins
  }),
  sessions = new Map();
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
origins.push(base);
async function call(u, path, method = 'GET', body, status = 200) {
  if (!sessions.has(u.id)) sessions.set(u.id, (await s.newSession(u)).token);
  const res = await fetch(base + '/api' + path, {
    method,
    headers: {
      Cookie: 'spokemon_session=' + sessions.get(u.id),
      'X-Spokemon-Request': '1',
      Origin: 'http://test.local',
      'Content-Type': 'application/json'
    },
    ...(body === undefined ? {} : {
      body: JSON.stringify(body)
    })
  });
  const data = await res.json();
  assert.equal(res.status, status, JSON.stringify(data));
  return data;
}
let browser;
try {
  await call(student, '/admin/curriculum', 'POST', {
    kind: 'subject',
    name: '허용 안됨'
  }, 403);
  const sub = await call(admin, '/admin/curriculum', 'POST', {
    kind: 'subject',
    name: 'Java 기초'
  });
  await call(admin, '/admin/curriculum', 'POST', {
    kind: 'subject',
    name: 'Java 기초'
  }, 409);
  const unit = await call(admin, '/admin/curriculum', 'POST', {
    kind: 'unit',
    subject: sub.id,
    name: '클래스와 객체'
  });
  assert.equal(unit.number, 1);
  const six = await call(admin, '/admin/curriculum', 'POST', {
    kind: 'unit',
    subject: 'vue',
    name: 'Vue 심화 프로젝트'
  });
  assert.equal(six.number, 6);
  await call(admin, '/admin/releases', 'PUT', {
    classId: 'unassigned',
    subject: 'vue',
    units: [6]
  });
  assert((await call(student, '/catalog')).find(x => x.id === 'vue').releasedUnits.includes(6));
  const body = {
    subject: sub.id,
    unit: 1,
    type: 'short',
    title: '클래스 키워드',
    prompt: '자바의 클래스 선언 키워드는?',
    acceptedAnswers: ['class'],
    explanation: 'class로 클래스를 선언합니다.',
    published: true,
    reviewed: true
  };
  const post = await call(admin, '/workshop', 'POST', body);
  await call(student, '/quiz/start', 'POST', {
    subject: sub.id,
    type: 'short'
  }, 403);
  await call(admin, '/admin/releases', 'PUT', {
    classId: 'unassigned',
    subject: sub.id,
    units: [1]
  });
  const quiz = await call(student, '/quiz/start', 'POST', {
    subject: sub.id,
    type: 'short'
  });
  assert.equal(quiz.question.source, 'official');
  assert(!quiz.question.acceptedAnswers);
  assert(!quiz.question.explanation);
  const results = await Promise.all(Array.from({
    length: 8
  }, () => call(student, '/quiz/' + quiz.id + '/submit', 'POST', {
    questionId: quiz.question.id,
    answer: ' CLASS '
  })));
  assert.equal(results.reduce((n, r) => n + r.awarded, 0), 20);
  assert.equal((await call(student, '/catalog')).find(x => x.id === sub.id).completed, 1);
  await call(other, '/quiz/' + quiz.id, 'GET', undefined, 404);
  await call(admin, '/workshop/' + post.id, 'PUT', {
    ...body,
    title: '클래스 키워드 수정',
    baseVersion: 1
  });
  const revised = await call(student, '/quiz/start', 'POST', {
    subject: sub.id,
    type: 'short'
  });
  assert.equal((await call(student, '/quiz/' + revised.id + '/submit', 'POST', {
    questionId: revised.question.id,
    answer: 'class'
  })).awarded, 0);
  assert.equal((await call(student, '/catalog')).find(x => x.id === sub.id).completed, 1);
  await call(admin, '/workshop/' + post.id + '/moderate', 'POST', {
    published: false
  });
  await call(student, '/quiz/' + revised.id, 'GET', undefined, 403);
  await call(admin, '/workshop/' + post.id + '/moderate', 'POST', {
    published: true
  });
  const mine = await call(student, '/workshop', 'POST', {
    ...body,
    unit: 0,
    source: 'official',
    title: '학생 문제'
  });
  assert.equal((await call(student, '/workshop/' + mine.id)).source, 'student');
  await call(student, '/admin/messages', 'POST', {
    studentId: other.id,
    title: '금지',
    content: '내용',
    requestKey: 'no-admin-send'
  }, 403);
  const send = {
    studentId: student.id,
    title: '선생님의 첫 쪽지',
    content: '오늘도 힘내세요!',
    requestKey: 'admin-first-message'
  };
  const delivered = await Promise.all(Array.from({
    length: 8
  }, () => call(admin, '/admin/messages', 'POST', send)));
  assert.equal(new Set(delivered.map(x => x.id)).size, 1);
  const id = delivered[0].id;
  assert.equal((await call(student, '/messages/summary')).unread, 1);
  const thread = await call(student, '/messages/' + id);
  assert(thread.fromAdmin);
  assert.equal(thread.replies[0].senderRole, 'admin');
  await call(other, '/messages/' + id, 'GET', undefined, 404);
  await call(other, '/messages/' + id, 'DELETE', undefined, 404);
  await call(student, '/messages/' + id + '/read', 'POST', {
    replyIds: thread.replies.map(x => x.id)
  });
  assert.equal((await call(student, '/messages/summary')).unread, 0);
  await call(student, '/messages/' + id + '/reply', 'POST', {
    content: '감사합니다!',
    requestKey: 'student-reply-key'
  });
  assert.equal((await call(admin, '/admin/messages?status=pending')).items.filter(x => x.id === id).length, 1);
  await call(admin, '/admin/messages/' + id + '/reply', 'POST', {
    content: '좋아요!',
    requestKey: 'admin-answer-key'
  });
  assert.equal((await call(admin, '/admin/messages?status=answered')).items.filter(x => x.id === id).length, 1);
  await call(student, '/messages/' + id, 'DELETE');
  assert.equal((await call(student, '/messages')).items.length, 0);
  assert.equal((await call(student, '/messages/summary')).unread, 0);
  assert((await call(admin, '/admin/messages')).items.some(x => x.id === id));
  await call(student, '/messages/' + id, 'GET', undefined, 404);
  await call(student, '/friends', 'POST', {
    studentId: other.id
  });
  await call(other, '/friends', 'POST', {
    studentId: student.id
  });
  const fm = await call(student, '/friend-messages', 'POST', {
    recipient: other.id,
    title: '친구 쪽지',
    content: '안녕',
    requestKey: 'friend-first-key'
  });
  await call(other, '/friend-messages/' + fm.id, 'DELETE');
  assert.equal((await call(other, '/friends')).items.length, 0);
  assert((await call(student, '/friends')).items.some(m => m.id === fm.id));
  assert.equal((await call(other, '/messages/summary')).unread, 0);
  assert.equal((await s.db.prepare('SELECT COUNT(*) n FROM private_messages').get()).n, 1);
  assert.equal((await s.db.prepare('SELECT COUNT(*) n FROM friend_mail').get()).n, 1);
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const context = await browser.newContext({
    viewport: {
      width: 1360,
      height: 900
    }
  });
  await context.addCookies([{
    name: 'spokemon_session',
    value: sessions.get(admin.id),
    url: base
  }]);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  await page.goto(base + '/#/admin?section=content');
  await page.getByRole('heading', {
    name: '과목·단원 / 공식 문제 관리'
  }).waitFor();
  await page.getByRole('button', {
    name: '＋ 공식 문제 추가',
    exact: true
  }).click();
  await page.locator('.manual-common select').nth(0).selectOption(sub.id);
  await page.locator('.manual-common select').nth(1).selectOption('1');
  await page.locator('.manual-question select').selectOption('short');
  await page.getByLabel('문제 제목', {
    exact: true
  }).fill('화면 공식 문제');
  await page.getByLabel('문제 내용', {
    exact: true
  }).fill('정수 자료형 이름은?');
  await page.getByLabel('허용 정답 (여러 개는 |로 구분)').fill('int');
  await page.getByLabel('해설', {
    exact: true
  }).fill('int는 정수 자료형입니다.');
  await page.getByLabel('문제·정답·해설을 직접 검토했습니다.').check();
  await page.getByRole('button', {
    name: '문제 1개 저장',
    exact: true
  }).click();
  await page.getByText('공식 문제를 저장했어요.', {
    exact: true
  }).waitFor();
  await page.locator('.admin-section-nav button').filter({hasText:'학생 쪽지함'}).click();
  await page.getByRole('button', {
    name: '＋ 학생에게 쪽지 쓰기'
  }).click();
  await page.locator('.admin-compose select').selectOption(student.id);
  await page.locator('.admin-compose').getByLabel('제목', {
    exact: true
  }).fill('화면 발신 쪽지');
  await page.locator('.admin-compose').getByLabel('내용', {
    exact: true
  }).fill('화면에서 보냈습니다.');
  await page.getByRole('button', {
    name: '학생에게 보내기',
    exact: true
  }).click();
  await page.getByText('학생에게 쪽지를 보냈어요.', {
    exact: true
  }).waitFor();
  await page.locator('.admin-section-nav button').filter({hasText:'기수·진도'}).click();
  const color = await page.locator('.release-check.checked').first().evaluate(el => getComputedStyle(el).backgroundColor);
  assert.notEqual(color, 'rgb(223, 236, 201)');
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  const studentContext = await browser.newContext({
    viewport: {
      width: 390,
      height: 844
    }
  });
  await studentContext.addCookies([{
    name: 'spokemon_session',
    value: sessions.get(student.id),
    url: base
  }]);
  const sp = await studentContext.newPage();
  sp.on('dialog', d => d.accept());
  sp.on('pageerror', e => errors.push(e.message));
  await sp.goto(base + '/#/pet/mailbox');
  await sp.getByRole('button', {
    name: '화면 발신 쪽지 →'
  }).click();
  await sp.getByLabel('관리자에게 답장').fill('확인했습니다.');
  await sp.getByRole('button', {
    name: '답장 보내기',
    exact: true
  }).click();
  await sp.getByText('확인했습니다.', {
    exact: true
  }).waitFor();
  await sp.getByRole('button', {
    name: '쪽지 삭제',
    exact: true
  }).click();
  await sp.getByRole('heading', {
    name: '관리자와 주고받은 쪽지'
  }).waitFor();
  assert(await sp.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  assert.deepEqual(errors, []);
  await browser.close();
  browser = null;
  const reopened = await createService(file);
  assert((await reopened.curriculum()).some(x => x.id === sub.id));
  assert.equal((await reopened.catalog(student)).find(x => x.id === sub.id).total, 2);
  await reopened.close();
  console.log('PASS: admin-only subject/unit additions (including unit 6), dynamic official authoring/quiz/progress/revision rewards/locks, 8-way mail idempotency, admin-first/student replies, private reversible deletion+badges+friend isolation, persistence; desktop/mobile authoring and mailbox UI, themed release rows, no browser errors/overflow.');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
  await s.close();
}
