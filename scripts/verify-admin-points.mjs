import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
const file = join(mkdtempSync(join(tmpdir(), 'spokemon-admin-points-')), 'app.sqlite'),
  s = await createService(file),
  password = 'test-only-pass',
  a = await s.createUser({
    login: 'points_admin',
    nickname: '지급관리자',
    password,
    role: 'admin'
  }),
  u = await s.createUser({
    login: 'points_student',
    nickname: '지급학생',
    password
  }),
  other = await s.createUser({
    login: 'points_other',
    nickname: '다른학생',
    password
  }),
  deleted = await s.createUser({
    login: 'points_deleted',
    nickname: '삭제학생',
    password
  }),
  origins = ['http://test.local'],
  server = await createHttp(s, {
    origins
  }),
  tokens = new Map();
await s.deleteStudent(a, deleted.id, {
  confirmLogin: deleted.login
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port;
origins.push(base);
async function call(actor, id, method = 'GET', body, status = 200) {
  if (!tokens.has(actor.id)) tokens.set(actor.id, (await s.newSession(actor)).token);
  const res = await fetch(base + '/api/admin/students/' + id + '/points', {
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
let browser;
try {
  const payload = {
    amount: 500,
    reason: '수업 참여 보너스',
    requestKey: 'first-grant-500'
  };
  await call(u, u.id, 'POST', payload, 403);
  await call(u, other.id, 'GET', undefined, 403);
  await call(a, a.id, 'POST', payload, 404);
  await call(a, deleted.id, 'POST', payload, 404);
  for (const amount of [0, -1, 1.5, 1000001, '500', null]) await call(a, u.id, 'POST', {
    ...payload,
    amount
  }, 400);
  await call(a, u.id, 'POST', {
    ...payload,
    reason: '  '
  }, 400);
  await call(a, u.id, 'POST', {
    ...payload,
    reason: 'x'.repeat(201)
  }, 400);
  const grants = await Promise.all(Array.from({
    length: 20
  }, () => call(a, u.id, 'POST', payload)));
  assert.equal(grants.filter(g => !g.duplicate).length, 1);
  assert.equal(new Set(grants.map(g => g.id)).size, 1);
  const account = await call(a, u.id);
  assert.equal(account.balance, 500);
  assert.equal(account.grants.length, 1);
  assert.equal(account.grants[0].admin_name, a.name);
  await call(a, u.id, 'POST', {
    ...payload,
    amount: 501
  }, 409);
  await call(a, other.id, 'POST', payload, 409);
  const records = (await s.state(u)).data.records;
  assert.equal(records[0].game, '관리자 포인트 지급');
  assert(records[0].detail.includes('수업 참여 보너스'));
  assert.equal((await s.db.prepare('SELECT COUNT(*) n FROM quiz_awards').get()).n, 0);
  const before = (await s.db.prepare('SELECT COUNT(*) n FROM ledger').get()).n;
  await s.db.exec("CREATE TRIGGER fail_points BEFORE UPDATE OF coins ON users BEGIN SELECT RAISE(ABORT,'test rollback'); END;");
  await assert.rejects(s.points.grant(a, u.id, {
    amount: 100,
    reason: '롤백 테스트',
    requestKey: 'rollback-grant'
  }));
  assert.equal((await s.db.prepare('SELECT COUNT(*) n FROM ledger').get()).n, before);
  assert.equal((await s.db.prepare('SELECT COUNT(*) n FROM admin_point_grants').get()).n, 1);
  await s.db.exec('DROP TRIGGER fail_points');
  const second = await createService(file);
  assert.equal((await second.points.read(a, u.id)).balance, 500);
  assert((await second.points.grant(a, u.id, payload)).duplicate);
  await second.close();
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
    value: tokens.get(a.id),
    url: base
  }]);
  const page = await context.newPage(),
    errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(base + '/#/admin?section=points');
  await page.getByRole('heading', {
    name: '학생 포인트 지급',
    exact: true
  }).waitFor();
  const panel = page.locator('.admin-point-grants');
  await panel.locator('select').selectOption(u.id);
  await panel.getByText('현재 보유 500 P', {
    exact: true
  }).waitFor();
  await panel.getByLabel('지급 포인트', {
    exact: false
  }).fill('250');
  await panel.getByLabel('지급 사유', {
    exact: true
  }).fill('과제 우수 제출');
  await panel.getByRole('button', {
    name: '포인트 지급',
    exact: true
  }).click();
  await page.getByRole('dialog', {
    name: '학생 포인트 지급 확인'
  }).waitFor();
  await page.getByRole('button', {
    name: '취소',
    exact: true
  }).click();
  assert.equal((await s.points.read(a, u.id)).balance, 500);
  await panel.getByRole('button', {
    name: '포인트 지급',
    exact: true
  }).click();
  await page.getByRole('button', {
    name: '지급 확정',
    exact: true
  }).click();
  await panel.getByText('지급학생 학생에게 250 P를 지급했어요.', {
    exact: true
  }).waitFor();
  assert.equal((await s.points.read(a, u.id)).balance, 750);
  await page.setViewportSize({
    width: 390,
    height: 844
  });
  await panel.locator('summary').click();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  assert.equal(await panel.getByText('과제 우수 제출', {
    exact: true
  }).count(), 1);
  const studentContext = await browser.newContext();
  await studentContext.addCookies([{
    name: 'spokemon_session',
    value: tokens.get(u.id),
    url: base
  }]);
  const sp = await studentContext.newPage();
  await sp.goto(base + '/#/student');
  await sp.locator('.point-history summary').click();
  await sp.getByText('지급관리자 관리자 · 과제 우수 제출', {
    exact: true
  }).waitFor();
  assert.equal(await sp.getByRole('heading', {
    name: '학생 포인트 지급',
    exact: true
  }).count(), 0);
  assert.deepEqual(errors, []);
  console.log('PASS: administrator-only grants, student/deleted-target/amount guards, 20 concurrent retries one ledger+balance change, payload mismatch rejection, transactional rollback, restart persistence, separate quiz rewards; confirm/cancel/grant/history/student receipt and responsive UI.');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
  await s.close();
}
