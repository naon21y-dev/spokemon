const {
    chromium
  } = require('playwright'),
  assert = require('node:assert/strict'),
  fs = require('node:fs'),
  path = require('node:path');
(async () => {
  const {
      createService
    } = await import('../server/service.mjs'),
    {
      createHttp
    } = await import('../server/http.mjs');
  const s = await createService(':memory:'),
    password = 'test-only-pass',
    admin = await s.createUser({
      login: 'type_teacher',
      nickname: '관리자',
      role: 'admin',
      password
    }),
    student = await s.createUser({
      login: 'type_student',
      nickname: '모바일학생',
      password
    });
  await s.release(admin, {
    classId: 'unassigned',
    subject: 'javascript',
    units: [1, 2, 3, 4, 5]
  });
  await s.startQuiz(student, {
    subject: 'javascript',
    type: 'all'
  });
  const origins = [],
    server = await createHttp(s, {
      origins
    });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const output = path.resolve('artifacts/mobile-type-layout'),
    baseline = process.argv.includes('--baseline'),
    browser = await chromium.launch({
      headless: true,
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    });
  try {
    const context = await browser.newContext();
    await context.addCookies([{
      name: 'spokemon_session',
      value: (await s.newSession(student)).token,
      url: base
    }]);
    const page = await context.newPage(),
      errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(base + '/#/quiz');
    await page.getByRole('button', {
      name: /JavaScript/
    }).click();
    await page.locator('.hub-type-panel').waitFor();
    await page.evaluate(() => document.fonts.ready);
    for (const [width, height] of [[1366, 768], [1920, 1080]]) {
      await page.setViewportSize({
        width,
        height
      });
      await page.waitForTimeout(100);
      const shot = await page.screenshot(),
        file = path.join(output, 'desktop-' + width + '.png');
      if (baseline || !fs.existsSync(file)) fs.writeFileSync(file, shot);else assert.ok(shot.equals(fs.readFileSync(file)), 'desktop design changed at ' + width);
    }
    if (baseline) {
      console.log('Captured desktop baseline at 1366 and 1920px.');
      return;
    }
    for (const [width, height] of [[430, 932], [390, 844], [360, 740], [375, 667], [320, 568], [600, 800]]) {
      await page.setViewportSize({
        width,
        height
      });
      await page.waitForTimeout(80);
      assert.equal(await page.locator('.study-mode').count(), 3);
      const aside = await page.locator('.quiz-hub-aside').boundingBox(),
        panel = await page.locator('.hub-type-panel').boundingBox();
      assert.ok(panel.y + panel.height <= aside.y + 1, 'panel overlaps aside ' + width);
      assert.ok(await page.evaluate(() => document.documentElement.scrollHeight <= innerHeight + 1 && document.documentElement.scrollWidth <= innerWidth + 1), 'page overflow ' + width);
      for (const mode of await page.locator('.study-mode').all()) {
        await mode.scrollIntoViewIfNeeded();
        const box = await mode.boundingBox();
        assert.ok(box.x >= 0 && box.x + box.width <= width + 1 && box.y >= panel.y && box.y + box.height <= aside.y, 'mode outside panel ' + width);
        assert.ok(await mode.evaluate(n => {
          const b = n.getBoundingClientRect();
          return [...n.children].every(c => {
            const r = c.getBoundingClientRect();
            return r.top >= b.top && r.bottom <= b.bottom + 1;
          });
        }), 'mode text overflow ' + width);
      }
      await page.locator('.study-modes').evaluate(n => n.scrollTop = 0);
      await page.screenshot({
        path: path.join(output, 'mobile-' + width + '.png')
      });
    }
    await page.setViewportSize({
      width: 390,
      height: 844
    });
    await page.getByRole('button', {
      name: /^객관식/
    }).click();
    await page.locator('.study-question').waitFor();
    assert.equal((await s.learningState(student)).activeQuiz.questionIds.length, 15);
    assert.deepEqual(errors, []);
    console.log('PASS: all three type cards contained without overlap at 6 mobile viewports, sidebar visible, quiz start works, and desktop screenshots are byte-identical at 1366/1920px.');
  } finally {
    await browser.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
