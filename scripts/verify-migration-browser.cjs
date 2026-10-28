const {
  chromium
} = require('playwright');
const {
  randomBytes,
  pbkdf2Sync
} = require('node:crypto');
const assert = require('node:assert/strict');
(async () => {
  const {
      createService
    } = await import('../server/service.mjs'),
    {
      createHttp
    } = await import('../server/http.mjs');
  const s = await createService(':memory:'),
    origins = [],
    server = await createHttp(s, {
      origins
    });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  origins.push(base);
  const password = randomBytes(18).toString('base64url'),
    salt = randomBytes(12).toString('hex'),
    digest = pbkdf2Sync(password, salt, 150000, 32, 'sha256').toString('hex'),
    legacy = {
      accounts: [{
        id: 'old-browser-account',
        login: 'old_player',
        nickname: '이전학생',
        salt,
        digest,
        progress: {
          coins: 829,
          records: [{
            game: '카드 뒤집기',
            coins: 80
          }],
          pet: {
            character: 'gengar',
            xp: 250,
            hunger: 80,
            happy: 90,
            owned: [],
            wear: '',
            last: Date.now()
          },
          learning: {
            history: [],
            mistakes: {}
          }
        }
      }],
      migrated: true
    };
  const b = await chromium.launch({
    headless: true,
    ...(require('node:fs').existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe') ? {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'
    } : {})
  });
  try {
    const context = await b.newContext(),
      p = await context.newPage();
    await p.goto(base + '/#/account');
    await p.evaluate(value => localStorage.setItem('pocket-accounts-v1', JSON.stringify(value)), legacy);
    await p.locator('#login-id').fill('old_player');
    await p.locator('#password').fill(password);
    await p.getByRole('button', {
      name: '로그인하고 플레이',
      exact: true
    }).click();
    await p.waitForURL('**/#/student');
    const u = await s.db.prepare("SELECT * FROM users WHERE login='old_player'").get();
    assert.ok(u);
    assert.equal(u.role, 'student');
    assert.equal((await s.state(u)).data.legacyMigration.coins, 829);
    assert.equal((await s.state(u)).data.legacyMigration.status, 'pending');
    assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('pocket-accounts-v1'))).accounts[0].progress.coins, 829);
    const admin = await s.createUser({
      login: 'migration_teacher',
      password,
      nickname: '이전관리자',
      role: 'admin'
    });
    await s.approveMigration(admin, u.id);
    await p.reload();
    await p.getByRole('heading', {
      name: '과목별 진도',
      exact: true
    }).waitFor();
    assert.equal(await p.locator('.wallet>span b').textContent(), '829');
    assert.equal((await s.state(u)).data.pet.xp, 250);
    assert.equal(JSON.parse(await p.evaluate(() => localStorage.getItem('pocket-accounts-v1'))).accounts[0].progress.coins, 829);
    console.log('PASS: actual legacy PBKDF2 login upgrades to student account, snapshot submitted pending approval, exact old coins/pet restored, local original remains unchanged.');
  } finally {
    await b.close();
    await new Promise(async r => await server.close(r));
    await s.close();
  }
})().catch(e => {
  console.error(e);
  process.exitCode = 1;
});
