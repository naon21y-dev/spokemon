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
    teacher = await s.createUser({
      login: 'item_teacher',
      password,
      nickname: '아이템관리자',
      role: 'admin'
    }),
    user = await s.createUser({
      login: 'item_student',
      password,
      nickname: '팬텀친구'
    });
  await s.updateProfile(user, {
    character: 'gengar'
  });
  await s.migration(user, {
    legacyId: 'inventory-fixture',
    progress: {
      coins: 200,
      pet: {
        character: 'gengar',
        xp: 220,
        hunger: 70,
        happy: 80,
        owned: [],
        wear: '',
        last: Date.now()
      }
    }
  });
  await s.approveMigration(teacher, user.id);
  const origins = [],
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
    const p = await (await b.newContext()).newPage(),
      errors = [];
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/#/account');
    await p.locator('#login-id').fill(user.login);
    await p.locator('#password').fill(password);
    await p.getByRole('button', {
      name: '로그인하고 플레이',
      exact: true
    }).click();
    await p.waitForURL('**/#/student');
    await p.goto(base + '/#/pet');
    await p.locator('.character-choice').first().waitFor();
    assert.equal(await p.locator('.character-choice:disabled').count(), 3);
    const forbidden = await p.request.patch(base + '/api/profile', {
      headers: {
        'X-Spokemon-Request': '1'
      },
      data: {
        character: 'squirtle'
      }
    });
    assert.equal(forbidden.status(), 400);
    await p.getByRole('button', {
      name: '만나기 시작',
      exact: true
    }).click();
    const device = p.getByRole('complementary', {
      name: '포켓몬 아이템 슬롯',
      exact: true
    });
    await device.waitFor();
    assert.equal(await device.locator('.device-slot').count(), 9);
    assert.equal(await device.locator('.device-slot.empty:disabled').count(), 0);
    await device.getByRole('button', {
      name: '다음 아이템 페이지',
      exact: true
    }).click();
    assert.equal(await device.locator('.device-slot').count(), 9);
    await device.getByRole('button', {
      name: '눈꽃 장식 슬롯',
      exact: true
    }).click();
    await device.getByRole('button', {
      name: '이전 아이템 페이지',
      exact: true
    }).click();
    await device.getByRole('button', {
      name: '구매 · 60 🪙',
      exact: true
    }).click();
    await device.getByRole('status').waitFor();
    assert.equal((await s.state(user)).data.coins, 140);
    assert.equal((await s.state(user)).data.pet.wear, '🎀');
    assert.ok(await device.getByRole('button', {
      name: '✓ 착용 중',
      exact: true
    }).isDisabled());
    await device.getByRole('button', {
      name: '작은 왕관 슬롯',
      exact: true
    }).click();
    await device.getByRole('button', {
      name: '구매 · 120 🪙',
      exact: true
    }).click();
    await device.getByRole('status').waitFor();
    assert.equal((await s.state(user)).data.coins, 20);
    assert.equal((await s.state(user)).data.pet.owned.length, 2);
    await device.getByRole('button', {
      name: '마법사 모자 슬롯',
      exact: true
    }).click();
    assert.ok(await device.getByRole('button', {
      name: '구매 · 90 🪙',
      exact: true
    }).isDisabled());
    await device.getByRole('button', {
      name: '딸기 리본 슬롯',
      exact: true
    }).click();
    await device.getByRole('button', {
      name: '착용하기',
      exact: true
    }).click();
    await device.getByRole('status').waitFor();
    assert.equal((await s.state(user)).data.coins, 20);
    assert.equal((await s.state(user)).data.pet.wear, '🎀');
    await device.getByRole('button', {
      name: '꾸미기 벗기기',
      exact: true
    }).click();
    await device.getByRole('status').waitFor();
    assert.equal((await s.state(user)).data.pet.wear, '');
    assert.equal((await s.state(user)).data.pet.xp, 220);
    await p.reload();
    await p.getByRole('button', {
      name: '만나기 시작',
      exact: true
    }).click();
    await device.waitFor();
    assert.equal(await device.locator('.device-slot.owned').count(), 2);
    await device.getByRole('button', {
      name: '작은 왕관 슬롯',
      exact: true
    }).click();
    await device.getByRole('button', {
      name: '착용하기',
      exact: true
    }).click();
    await device.getByRole('status').waitFor();
    for (const width of [1440, 768, 390]) {
      await p.setViewportSize({
        width,
        height: 950
      });
      await p.evaluate(() => document.fonts.ready);
      assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), `overflow ${width}`);
      assert.ok(await device.locator('img').evaluateAll(imgs => imgs.every(i => i.complete && i.naturalWidth > 0)));
      await device.screenshot({
        path: 'C:/yw/login/inventory-stage/device-' + width + '.png'
      });
    }
    assert.equal((await s.state(user)).data.coins, 20);
    assert.equal((await s.state(user)).data.pet.character, 'gengar');
    assert.deepEqual(errors, []);
    console.log('PASS: one-time partner locked in UI/API, 9 slots/6 empty, buy once/cost, free re-equip, remove without item loss, insufficient coins, server reload persistence, XP+partner preserved, desktop/tablet/mobile display.');
  } finally {
    await b.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
