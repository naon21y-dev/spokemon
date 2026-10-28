import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
import { items } from '../src/data/items.js';
import { accessoryPlacement } from '../src/data/accessories.js';
const service = await createService(':memory:'),
  server = await createHttp(service),
  password = 'test-only-pass';
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port,
  users = [];
let browser;
try {
  browser = await chromium.launch({
    headless: true,
    executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
  });
  const guestContext = await browser.newContext({
      viewport: {
        width: 1360,
        height: 900
      }
    }),
    guest = await guestContext.newPage();
  await guest.goto(base + '/#/account');
  await guest.getByRole('heading', {
    name: '현재 접속중',
    exact: true
  }).waitFor();
  assert.equal(await guest.locator('.online-section .dex-side-key').count(), 9);
  for (let i = 0; i < 13; i++) {
    const u = await service.createUser({
        login: 'online_' + String(i).padStart(2, '0'),
        nickname: '접속학생' + i,
        password
      }),
      character = ['piplup', 'squirtle', 'gengar', 'bulbasaur'][i % 4],
      pet = {
        ...JSON.parse(u.pet),
        character,
        wear: '👑',
        owned: items.map(i => i.id)
      };
    await service.db.prepare('UPDATE users SET coins=5000,pet=?,partner_locked=1 WHERE id=?').run(JSON.stringify(pet), u.id);
    const session = await service.newSession(u);
    await service.db.prepare('INSERT INTO presence VALUES(?,?)').run(u.id, Date.now());
    users.push({
      u,
      token: session.token,
      character
    });
  }
  await guest.reload();
  await guest.locator('.online-heading').getByText('13명', {
    exact: true
  }).waitFor();
  assert.equal(await guest.locator('.online-student').count(), 13);
  assert.equal(await guest.locator('.online-section .dex-side-key').count(), 15);
  const grid = guest.locator('.online-section .dex-side-grid');
  assert(await grid.evaluate(el => el.scrollHeight > el.clientHeight + 10));
  await grid.evaluate(el => el.scrollTop = el.scrollHeight);
  assert(await grid.evaluate(el => el.scrollTop > 0));
  assert(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
  mkdirSync('artifacts', {
    recursive: true
  });
  await guest.screenshot({
    path: 'artifacts/online-scroll-desktop.png',
    fullPage: false
  });
  const errors = [];
  for (const {
    u,
    token,
    character
  } of users.slice(0, 4)) {
    const c = await browser.newContext({
      viewport: {
        width: 1360,
        height: 900
      }
    });
    await c.addCookies([{
      name: 'spokemon_session',
      value: token,
      url: base
    }]);
    const p = await c.newPage();
    p.on('pageerror', e => errors.push(e.message));
    await p.goto(base + '/#/pet');
    await p.getByRole('button', {
      name: '만나기 시작',
      exact: true
    }).click();
    await p.locator('.pet-scene .dressed-partner img').waitFor();
    await p.locator('.pet-scene .dressed-partner img').evaluate(img => img.decode());
    for (const width of [1360, 390]) {
      await p.setViewportSize({
        width,
        height: 900
      });
      const img = await p.locator('.pet-scene .dressed-partner img').boundingBox(),
        wear = await p.locator('.pet-scene .partner-accessory').boundingBox(),
        eye = accessoryPlacement(character, '🕶️');
      assert(wear.y + wear.height < img.y + eye.y / 100 * img.height, 'crown must sit above eyes: ' + character);
      assert(Math.abs(wear.x + wear.width / 2 - (img.x + accessoryPlacement(character, '👑').x / 100 * img.width)) < 2);
      assert(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2));
      assert.equal(await p.locator('.device-partner-wear').textContent(), '👑');
      await p.locator('.pet-scene').screenshot({
        path: 'artifacts/wear-' + character + '-' + width + '.png'
      });
    }
    if (character === 'squirtle') {
      await service.petAction(u, {
        action: 'wear',
        item: '🕶️'
      });
      await p.reload();
      await p.getByRole('button', {
        name: '만나기 시작',
        exact: true
      }).click();
      assert.equal(await p.locator('.pet-scene .partner-accessory').getAttribute('data-kind'), 'eyes');
      await p.locator('.pet-scene').screenshot({
        path: 'artifacts/wear-squirtle-glasses.png'
      });
    }
    await c.close();
  }
  for (const character of ['piplup', 'squirtle', 'gengar', 'bulbasaur']) for (const item of items) {
    const pos = accessoryPlacement(character, item.id);
    assert(pos.x > 0 && pos.x < 100 && pos.y > 0 && pos.y < 100 && pos.size > 0);
  }
  assert.deepEqual(errors, []);
  await service.db.prepare('UPDATE presence SET seen_at=0').run();
  await guest.reload();
  await guest.locator('.online-heading').getByText('0명', {
    exact: true
  }).waitFor();
  assert.equal(await guest.locator('.online-section .dex-side-key').count(), 9);
  console.log('PASS: all 13 online students returned, heading/count, 9-slot internal scroll+empty placeholders and expired-user removal; four character-specific crown anchors above eyes, device sync, goggles category, all item placements and desktop/mobile no overflow.');
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
  await service.close();
}
