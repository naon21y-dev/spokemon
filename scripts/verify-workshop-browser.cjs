const {
    chromium
  } = require('playwright'),
  assert = require('node:assert/strict');
(async () => {
  const {
      createService
    } = await import('../server/service.mjs'),
    {
      createHttp
    } = await import('../server/http.mjs');
  const s = await createService(':memory:'),
    password = 'test-only-pass',
    teacher = await s.createUser({
      login: 'workshop_teacher',
      nickname: '관리자',
      password,
      role: 'admin'
    }),
    a = await s.createUser({
      login: 'workshop_author',
      nickname: '문제제작자',
      password
    }),
    u = await s.createUser({
      login: 'workshop_solver',
      nickname: '풀이학생',
      password
    });
  await s.release(teacher, {
    classId: 'unassigned',
    subject: 'vue',
    units: [1]
  });
  const origins = [],
    server = await createHttp(s, {
      origins
    });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const b = await chromium.launch({
      headless: true,
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    }),
    errors = [];
  let id;
  async function page(user) {
    const context = await b.newContext();
    await context.addCookies([{
      name: 'spokemon_session',
      value: (await s.newSession(user)).token,
      url: base
    }]);
    const p = await context.newPage();
    p.on('pageerror', e => errors.push(e.message));
    return p;
  }
  try {
    const p = await page(a);
    await p.goto(base + '/#/workshop');
    await p.getByRole('button', {
      name: '＋ 문제 만들기',
      exact: true
    }).click();
    await p.getByLabel('문제 제목', {
      exact: true
    }).fill('브라우저로 만든 Vue 문제');
    await p.getByLabel('문제 내용', {
      exact: true
    }).fill('반응형 값을 만드는 함수는?');
    for (const [i, text] of ['ref', 'log', 'alert', 'fetch'].entries()) await p.getByRole('textbox', {
      name: '선택지 ' + (i + 1),
      exact: true
    }).fill(text);
    await p.getByLabel('해설', {
      exact: true
    }).fill('ref는 반응형 참조를 생성하는 Vue 함수입니다.');
    await p.getByLabel('문제·정답·해설을 직접 검토했습니다.').check();
    await p.getByRole('button', {
      name: '문제 1개 저장',
      exact: true
    }).click();
    await p.getByRole('button', {
      name: '원본 게시글 보기',
      exact: true
    }).click();
    await p.getByRole('button', {
      name: '문제 풀기',
      exact: true
    }).waitFor();
    const root = await s.db.prepare('SELECT * FROM workshop_posts WHERE author_id=?').get(a.id);
    id = root.id;
    assert.equal(root.published, 1);
    await p.getByRole('button', {
      name: '수정하기',
      exact: true
    }).click();
    await p.getByLabel('문제 제목', {
      exact: true
    }).fill('수정한 Vue 문제');
    await p.getByLabel('문제·정답·해설을 직접 검토했습니다.').check();
    await p.getByRole('button', {
      name: '새 버전 저장',
      exact: true
    }).click();
    await p.getByRole('button', {
      name: '원본 게시글 보기',
      exact: true
    }).click();
    await p.getByRole('button', {
      name: '문제 풀기',
      exact: true
    }).waitFor();
    assert.equal((await s.db.prepare('SELECT version FROM workshop_posts WHERE id=?').get(id)).version, 2);
    const solver = await page(u);
    await solver.goto(base + '/#/workshop?post=' + id);
    await solver.getByRole('button', {
      name: '문제 풀기',
      exact: true
    }).click();
    await solver.locator('.community-runner input[value="choice-1"]').check();
    await solver.getByRole('button', {
      name: '답안 제출',
      exact: true
    }).click();
    await solver.locator('.community-runner .study-feedback').waitFor();
    await solver.getByRole('button', {
      name: '결과 보기',
      exact: true
    }).click();
    await solver.getByRole('heading', {
      name: '풀이 결과',
      exact: true
    }).waitFor();
    await solver.goto(base + '/#/pet/mistakes');
    await solver.getByLabel('문제 출처').selectOption('student');
    await solver.locator('.mistake-entry').waitFor();
    assert.equal(await solver.locator('.mistake-entry .source-badge.student').count(), 1);
    await solver.getByRole('button', {
      name: '이 문제 다시 풀기',
      exact: true
    }).click();
    await solver.locator('.study-option input[value="choice-0"]').check();
    await solver.getByRole('button', {
      name: '답안 제출',
      exact: true
    }).click();
    await solver.locator('.study-feedback').waitFor();
    assert.equal((await s.state(u)).data.coins, 10);
    await solver.getByRole('button', {
      name: '결과 보기',
      exact: true
    }).click();
    await solver.getByRole('button', {
      name: '오답 목록으로',
      exact: true
    }).click();
    await solver.goto(base + '/#/workshop?post=' + id);
    await solver.getByRole('button', {
      name: '문제 풀기',
      exact: true
    }).click();
    await solver.locator('.community-runner input[value="choice-0"]').check();
    await solver.getByRole('button', {
      name: '답안 제출',
      exact: true
    }).click();
    await solver.getByRole('button', {
      name: '결과 보기',
      exact: true
    }).click();
    assert.equal((await s.state(u)).data.coins, 10);
    await solver.goto(base + '/#/student');
    await solver.getByRole('button', {
      name: '학생 제작',
      exact: true
    }).click();
    await solver.locator('.source-stats').getByText('3회', {
      exact: true
    }).waitFor();
    await solver.getByText('포인트 내역 · 출처와 지급 사유 보기', {
      exact: true
    }).click();
    await solver.locator('.point-history .source-badge.student').waitFor();
    await solver.goto(base + '/#/workshop');
    for (const width of [1366, 390, 360]) {
      await solver.setViewportSize({
        width,
        height: width === 1366 ? 768 : 844
      });
      await solver.evaluate(() => document.fonts.ready);
      assert.ok(await solver.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'workshop horizontal overflow ' + width);
      await solver.screenshot({
        path: 'C:/yw/login/workshop-stage/list-' + width + '.png',
        fullPage: true
      });
    }
    const admin = await page(teacher);
    await admin.goto(base + '/#/admin?section=points');
    await admin.getByLabel('학생 제작 문제 최초 정답', {
      exact: true
    }).fill('15');
    await admin.getByLabel('학생 문제 하루 최대 포인트', {
      exact: true
    }).fill('75');
    await admin.getByRole('button', {
      name: '보상 설정 저장',
      exact: true
    }).click();
    await admin.getByRole('status').filter({
      hasText: '보상 설정을 저장'
    }).waitFor();
    assert.equal((await s.workshop.settings()).student, 15);
    await admin.goto(base + '/#/workshop');
    await admin.getByRole('button', {
      name: '공유 숨기기',
      exact: true
    }).click();
    await admin.getByRole('button', {
      name: '공유 공개',
      exact: true
    }).waitFor();
    await assert.rejects(async () => await s.workshop.start(u, id), e => e.status === 404);
    assert.deepEqual(errors, []);
    console.log('PASS: browser author create/review/share/edit versions, student wrong/review reward once, duplicate no award, source-filter stats/mistakes/ledger, admin settings/moderation, desktop+mobile no overflow.');
  } finally {
    await b.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
