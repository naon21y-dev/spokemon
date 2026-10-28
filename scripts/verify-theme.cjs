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
    users = await Promise.all(['piplup', 'squirtle', 'gengar', 'bulbasaur'].map(async (character, i) => {
      const u = await s.createUser({
        login: 'theme_student_' + i,
        nickname: '테마학생' + i,
        password: 'test-only-pass'
      });
      await s.updateProfile(u, {
        character
      });
      return u;
    })),
    origins = [],
    server = await createHttp(s, {
      origins
    });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const b = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  try {
    const guest = await b.newPage();
    await guest.goto(base + '/#/account');
    for (const [width, height] of [[1870, 907], [1366, 768], [1280, 720], [390, 844], [360, 740]]) {
      await guest.setViewportSize({
        width,
        height
      });
      await guest.evaluate(() => document.fonts.ready);
      const result = await guest.evaluate(() => ({
        doc: document.documentElement.scrollHeight,
        h: innerHeight,
        box: (() => {
          const r = document.querySelector('.login-dex').getBoundingClientRect();
          return {
            top: r.top,
            bottom: r.bottom
          };
        })()
      }));
      assert.ok(result.doc <= height + 1 && result.box.top >= 0 && result.box.bottom <= height + 1, 'login outside viewport ' + width + ' ' + JSON.stringify(result));
      if (width > 600) for (const selector of ['.login-dex-screen', '.dex-side-grid']) {
        const box = await guest.locator(selector).boundingBox();
        assert.ok(box.y + box.height <= height + 1, selector + ' clipped ' + width);
      }
      const button = await guest.getByRole('button', {
        name: '로그인하고 플레이',
        exact: true
      }).boundingBox();
      assert.ok(button.y + button.height <= height + 1, 'login action clipped');
      await guest.screenshot({
        path: 'C:/yw/login/manual-stage/login-fit-' + width + '.png'
      });
    }
    const colors = [];
    for (const [i, user] of users.entries()) {
      const context = await b.newContext();
      await context.addCookies([{
        name: 'spokemon_session',
        value: (await s.newSession(user)).token,
        url: base
      }]);
      const p = await context.newPage();
      await p.setViewportSize({
        width: 1366,
        height: 768
      });
      await p.goto(base + '/#/quiz');
      await p.locator('.hub-subject').first().waitFor();
      assert.equal(await p.locator('html').getAttribute('data-partner'), ['piplup', 'squirtle', 'gengar', 'bulbasaur'][i]);
      colors.push(await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--rpg-mid').trim()));
      await p.screenshot({
        path: 'C:/yw/login/manual-stage/theme-' + i + '.png'
      });
      await p.goto(base + '/#/pet');
      await p.getByRole('button', {
        name: '만나기 시작',
        exact: true
      }).click();
      const device = p.locator('.item-device');
      await device.waitFor();
      assert.equal(await p.locator('.pet-scene').evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await p.locator('.device-identity').evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(255, 255, 255)');
      assert.equal(await device.evaluate(n => getComputedStyle(n).backgroundColor), 'rgb(217, 11, 56)');
      assert.equal(await p.locator('.device-slot').nth(1).evaluate(n => getComputedStyle(n).backgroundColor), await p.evaluate(() => {
        const e = document.createElement('i');
        e.style.color = 'var(--rpg-mid)';
        document.body.append(e);
        const c = getComputedStyle(e).color;
        e.remove();
        return c;
      }));
      await device.screenshot({
        path: 'C:/yw/login/manual-stage/themed-device-' + i + '.png'
      });
      await p.goto(base + '/#/cards');
      await p.getByRole('button', {
        name: 'START',
        exact: true
      }).waitFor();
      const fan = await p.locator('.card-intro-fan').boundingBox(),
        title = await p.locator('.card-game-intro h1').boundingBox();
      assert.ok(fan.y + fan.height <= title.y + 1, 'fan overlaps title');
      await context.close();
    }
    assert.equal(colors[0], colors[1]);
    assert.notEqual(colors[0], colors[2]);
    assert.notEqual(colors[2], colors[3]);
    const context = await b.newContext();
    await context.addCookies([{
      name: 'spokemon_session',
      value: (await s.newSession(users[0])).token,
      url: base
    }]);
    const p = await context.newPage();
    await p.route('**/api/catalog', async route => {
      await new Promise(r => setTimeout(r, 1200));
      await route.continue();
    });
    await p.goto(base + '/#/student');
    await p.getByRole('heading', {
      name: '불러오는 중…',
      exact: true
    }).waitFor();
    await p.locator('.page-state-overlay').waitFor({
      state: 'hidden'
    });
    await p.unroute('**/api/catalog');
    await p.route('**/api/catalog', route => route.abort());
    await p.reload();
    await p.getByRole('heading', {
      name: '잠시 연결이 끊겼어요',
      exact: true
    }).waitFor();
    await p.screenshot({
      path: 'C:/yw/login/manual-stage/loading-error.png'
    });
    await p.unroute('**/api/catalog');
    await p.getByRole('button', {
      name: '다시 시도',
      exact: true
    }).click();
    await p.locator('.page-state-overlay').waitFor({
      state: 'hidden'
    });
    await p.locator('.trainer-card').waitFor();
    await p.evaluate(() => window.dispatchEvent(new ErrorEvent('error', {
      error: new Error('simulated page error')
    })));
    await p.getByRole('button', {
      name: '다시 시도',
      exact: true
    }).waitFor();
    await p.getByRole('button', {
      name: '다시 시도',
      exact: true
    }).click();
    await p.locator('.page-state-overlay').waitFor({
      state: 'hidden'
    });
    console.log('PASS: entire login device+slots+submit within 5 viewports; all 4 character palettes including slots, white pet/identity and red casing; card fan no title overlap; slow loading, request failure, retry recovery and runtime-error recovery.');
  } finally {
    await b.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
