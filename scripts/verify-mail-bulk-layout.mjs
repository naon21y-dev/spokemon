import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
const service = await createService(join(mkdtempSync(join(tmpdir(), 'spokemon-mail-bulk-')), 'app.sqlite')),
  password = 'test-only-pass';
async function user(login, role = 'student') {
  return service.createUser({
    login,
    nickname: login,
    role,
    password
  });
}
const admin = await user('bulk_admin', 'admin'),
  admin2 = await user('bulk_teacher', 'admin'),
  u = await user('bulk_student'),
  v = await user('bulk_friend'),
  other = await user('bulk_other'),
  tokens = new Map(),
  origins = ['http://test.local'],
  server = await createHttp(service, {
    origins
  });
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
origins.push(base);
async function api(actor, path, method = 'GET', body, status = 200) {
  if (!tokens.has(actor.id)) tokens.set(actor.id, (await service.newSession(actor)).token);
  const res = await fetch(base + '/api' + path, {
    method,
    headers: {
      Cookie: 'spokemon_session=' + tokens.get(actor.id),
      Origin: 'http://test.local',
      'X-Spokemon-Request': '1',
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
let sequence = 0;
async function sendAdmin(title = '관리자 알림') {
  return api(admin, '/admin/messages', 'POST', {
    studentId: u.id,
    title,
    content: '관리자의 쪽지입니다.',
    requestKey: 'admin-message-' + ++sequence
  });
}
async function question(title = '학생 질문') {
  return api(u, '/messages', 'POST', {
    subject: 'vue',
    title,
    content: '질문이 있습니다.',
    requestKey: 'student-question-' + ++sequence
  });
}
async function friend(title = '친구 쪽지') {
  return api(v, '/friend-messages', 'POST', {
    recipient: u.id,
    title,
    content: '친구 쪽지입니다.',
    requestKey: 'friend-message-' + ++sequence
  });
}
let browser;
try {
  await api(u, '/friends', 'POST', {
    studentId: v.id
  });
  await api(v, '/friends', 'POST', {
    studentId: u.id
  });
  const first = await sendAdmin(),
    q = await question();
  await friend();
  assert.equal((await api(u, '/messages/summary')).events.length, 2);
  assert.equal((await api(other, '/messages/summary')).events.length, 0);
  assert((await api(admin, '/messages/summary')).events.some(e => e.id === 'question:' + q.id));
  await api(u, '/admin/messages', 'DELETE', {
    confirmed: true
  }, 403);
  await api(u, '/messages', 'DELETE', {}, 400);
  await api(admin, '/friend-messages', 'DELETE', {
    confirmed: true
  }, 403);
  await api(u, '/messages', 'DELETE', {
    confirmed: true
  });
  assert.equal((await api(u, '/messages')).items.length, 0);
  assert((await api(admin, '/admin/messages')).items.some(m => m.id === first.id));
  assert.equal((await api(u, '/messages/summary')).unread, 1);
  assert.equal((await api(u, '/messages', 'DELETE', {
    confirmed: true
  })).changed, 0);
  await api(admin, '/admin/messages', 'DELETE', {
    confirmed: true
  });
  assert.equal((await api(admin, '/messages/summary')).pending, 0);
  assert.equal((await api(admin2, '/messages/summary')).pending, 1);
  await api(admin, '/admin/messages/' + q.id + '/reply', 'POST', {
    content: '새 답장',
    requestKey: 'new-reply-after-clear'
  });
  assert((await api(u, '/messages')).items.some(m => m.id === q.id));
  assert((await api(u, '/messages/summary')).events.some(e => e.id.startsWith('reply:')));
  await api(u, '/messages/' + q.id + '/reply', 'POST', {
    content: '추가 질문',
    requestKey: 'reply-to-cleared-admin'
  });
  assert((await api(admin, '/admin/messages')).items.some(m => m.id === q.id));
  await api(u, '/friend-messages', 'DELETE', {
    confirmed: true
  });
  assert.equal((await api(u, '/friends')).items.length, 0);
  assert.equal((await api(u, '/friends')).friends.length, 1);
  assert.equal((await api(v, '/friends')).items.length, 1);
  await api(u, '/messages', 'DELETE', {
    confirmed: true
  });
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
    value: tokens.get(u.id),
    url: base
  }]);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('dialog', d => d.accept());
  const initial = page.waitForResponse(r => r.url().endsWith('/api/messages/summary'));
  await page.goto(base + '/#/home');
  await initial;
  assert.equal(await page.getByRole('dialog', {
    name: '새 쪽지 알림'
  }).count(), 0);
  const arrival = await sendAdmin('팝업 관리자 쪽지');
  await friend('팝업 친구 쪽지');
  const popup = page.getByRole('dialog', {
    name: '새 쪽지 알림'
  });
  await popup.waitFor({
    timeout: 22000
  });
  await popup.getByText('새 쪽지 2개를 확인해 보세요.', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: '새 쪽지 알림 닫기'
  }).click();
  assert.equal((await api(u, '/messages/summary')).unread, 2);
  const refreshed = page.waitForResponse(r => r.url().endsWith('/api/messages/summary'));
  await page.reload();
  await refreshed;
  assert.equal(await popup.count(), 0);
  const thread = await api(u, '/messages/' + arrival.id);
  await api(u, '/messages/' + arrival.id + '/read', 'POST', {
    replyIds: thread.replies.map(r => r.id)
  });
  await friend('새 친구 쪽지');
  await popup.waitFor({
    timeout: 22000
  });
  await popup.getByText('새 쪽지 1개를 확인해 보세요.', {
    exact: true
  }).waitFor();
  await popup.getByRole('button', {
    name: '쪽지함 열기'
  }).click();
  await page.getByRole('heading', {
    name: '내 친구',
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: '친구 쪽지 전체 삭제',
    exact: true
  }).click();
  await page.getByText('친구와 주고받은 쪽지가 없어요.', {
    exact: true
  }).waitFor();
  await page.getByRole('button', {
    name: '관리자 쪽지',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '관리자 쪽지 전체 삭제',
    exact: true
  }).click();
  assert.equal((await api(u, '/messages')).items.length, 0);
  const adminContext = await browser.newContext({
    viewport: {
      width: 1360,
      height: 900
    }
  });
  await adminContext.addCookies([{
    name: 'spokemon_session',
    value: tokens.get(admin.id),
    url: base
  }]);
  const ap = await adminContext.newPage();
  ap.on('pageerror', e => errors.push(e.message));
  ap.on('dialog', d => d.accept());
  await ap.goto(base + '/#/admin');
  await ap.getByRole('navigation', {
    name: '관리자 메뉴'
  }).waitFor();
  assert.equal(await ap.locator('.admin-section-nav button').count(), 5);
  assert.equal(await ap.locator('.admin-content').count(), 0);
  const close = ap.getByRole('button', {
    name: '새 쪽지 알림 닫기'
  });
  if (await close.count()) await close.click();
  for (const [name, selector] of [['과목·공식 문제', '.admin-content'], ['포인트 관리', '.admin-point-grants'], ['기수·진도', '.release-form'], ['학생 쪽지함', '.admin-mailbox']]) {
    await ap.locator('.admin-section-nav button').filter({
      hasText: name
    }).click();
    await ap.locator(selector).waitFor();
  }
  await ap.getByRole('button', {
    name: '학생 쪽지 전체 삭제',
    exact: true
  }).click();
  assert.equal((await api(admin, '/admin/messages')).items.length, 0);
  assert((await api(admin2, '/admin/messages')).items.length > 0);
  await ap.reload();
  await ap.locator('.admin-mailbox').waitFor();
  mkdirSync('artifacts', {
    recursive: true
  });
  await ap.screenshot({
    path: 'artifacts/admin-sections-desktop.png',
    fullPage: false
  });
  await ap.setViewportSize({
    width: 390,
    height: 844
  });
  assert(await ap.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  assert.equal(await ap.locator('.admin-section-nav button[aria-pressed="true"]').count(), 1);
  await sendAdmin('모바일 팝업');
  await page.bringToFront();
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await popup.waitFor({
    timeout: 22000
  });
  assert(await popup.evaluate(el => {
    const r = el.getBoundingClientRect();
    return r.x >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
  }));
  await page.screenshot({
    path: 'artifacts/mail-arrival-mobile.png',
    fullPage: false
  });
  assert.deepEqual(errors, []);
  assert((await service.db.prepare('SELECT COUNT(*) n FROM private_messages').get()).n >= 4);
  assert((await service.db.prepare('SELECT COUNT(*) n FROM friend_mail').get()).n >= 3);
  console.log('PASS: scoped atomic bulk deletion, replay safety, preserved originals/friends/other inboxes, new reply restores delivery; private/friend/admin notifications, no self/foreign leaks, stable-count arrivals, dismissed/reload dedupe, popup navigation+mobile fit, 5-section admin layout+reload and mobile overflow.');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
  await service.close();
}
