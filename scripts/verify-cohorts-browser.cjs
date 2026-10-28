const {
    chromium
  } = require('playwright'),
  assert = require('node:assert/strict'),
  {
    randomBytes
  } = require('node:crypto'),
  {
    existsSync
  } = require('node:fs');
(async () => {
  const {
      createService
    } = await import('../server/service.mjs'),
    {
      createHttp
    } = await import('../server/http.mjs');
  const s = await createService(':memory:'),
    password = randomBytes(18).toString('base64url'),
    adminUser = await s.createUser({
      login: 'cohort_admin_ui',
      password,
      nickname: '관리선생님',
      role: 'admin'
    }),
    studentUser = await s.createUser({
      login: 'cohort_student_ui',
      password,
      nickname: '학습학생'
    }),
    origins = [],
    server = await createHttp(s, {
      origins
    });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const b = await chromium.launch({
    headless: true,
    ...(existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    } : {})
  });
  try {
    const admin = await (await b.newContext()).newPage(),
      student = await (await b.newContext()).newPage(),
      errors = [];
    for (const p of [admin, student]) p.on('pageerror', e => errors.push(e.message));
    async function login(p, u) {
      await p.goto(base + '/#/account');
      await p.locator('#login-id').fill(u.login);
      await p.locator('#password').fill(password);
      await p.getByRole('button', {
        name: '로그인하고 플레이',
        exact: true
      }).click();
      await p.waitForURL(u.role === 'admin' ? '**/#/admin' : '**/#/student');
    }
    ;
    await login(admin, adminUser);
    assert.deepEqual(await admin.locator('nav a').allTextContents(), ['관리자 페이지']);
    await admin.goto(base + '/#/');
    await admin.waitForURL('**/#/admin');
    await admin.getByRole('heading', {
      name: '기수 관리와 진도 공개',
      exact: true
    }).waitFor();
    assert.equal(await admin.locator('.partner-wallet').count(), 0);
    await admin.getByLabel('새 기수 이름', {
      exact: true
    }).fill('제27기');
    await admin.getByRole('button', {
      name: '기수 등록',
      exact: true
    }).click();
    await admin.getByRole('status').filter({
      hasText: '기수를 등록했어요'
    }).waitFor();
    const cohort = await s.db.prepare('SELECT id FROM classes WHERE name=?').get('제27기');
    assert.ok(cohort);
    const row = admin.locator('tbody tr').filter({
      hasText: '학습학생'
    });
    await row.locator('select').selectOption(cohort.id);
    await admin.getByRole('status').filter({
      hasText: '기수를 변경했어요'
    }).waitFor();
    const form = admin.locator('.release-form');
    await form.locator('select').first().selectOption(cohort.id);
    assert.equal(await form.getByRole('checkbox').count(), 5);
    await form.getByRole('checkbox').nth(0).check();
    await form.getByRole('checkbox').nth(2).check();
    await form.getByRole('button', {
      name: '선택 항목 공개 저장',
      exact: true
    }).click();
    await admin.getByRole('status').filter({
      hasText: '선택한 학습 항목을 공개했어요'
    }).waitFor();
    await admin.reload();
    await form.locator('select').first().selectOption(cohort.id);
    await admin.waitForTimeout(100);
    assert.ok(await form.getByRole('checkbox').nth(0).isChecked());
    assert.ok(!(await form.getByRole('checkbox').nth(1).isChecked()));
    assert.ok(await form.getByRole('checkbox').nth(2).isChecked());
    await form.locator('select').nth(1).selectOption('python');
    assert.ok(!(await form.getByRole('checkbox').nth(0).isChecked()));
    await form.locator('select').nth(1).selectOption('vue');
    assert.ok(await form.getByRole('checkbox').nth(2).isChecked());
    await login(student, studentUser);
    await student.getByRole('heading', {
      name: '과목별 진도',
      exact: true
    }).waitFor();
    const vue = student.locator('.unit-subject').first();
    assert.equal(await vue.locator('.unit-tile:not(.locked)').count(), 2);
    assert.equal(await vue.locator('.unit-tile.locked').count(), 3);
    await student.goto(base + '/#/learn/vue/2');
    await student.getByRole('heading', {
      name: /아직 배우지 않은 단원입니다/
    }).waitFor();
    await student.goto(base + '/#/learn/vue/3');
    await student.getByRole('button', {
      name: '이 단원 퀴즈 풀기',
      exact: true
    }).waitFor();
    await admin.goto(base + '/#/account');
    assert.equal(await admin.locator('.partner-avatar').count(), 0);
    assert.ok(!(await admin.locator('.account-panel').textContent()).includes('Lv.'));
    await admin.goto(base + '/#/admin');
    for (const width of [390, 1440]) {
      await admin.setViewportSize({
        width,
        height: 900
      });
      await admin.evaluate(() => document.fonts.ready);
      assert.ok(await admin.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    }
    await admin.screenshot({
      path: 'C:/yw/login/cohort-stage/admin-checkboxes.png',
      fullPage: true
    });
    assert.deepEqual(errors, []);
    console.log('PASS: cohort create/assign UI, 5 checkboxes and saved noncontiguous selection, subject switching, student locks/direct URL, admin level removal, responsive layout.');
  } finally {
    await b.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
