import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { randomBytes } from 'node:crypto';
const socket = createServer();
await new Promise(r => socket.listen(0, '127.0.0.1', r));
const port = socket.address().port;
await new Promise(async r => await socket.close(r));
const base = 'http://127.0.0.1:' + port,
  db = join(mkdtempSync(join(tmpdir(), 'spokemon-render-')), 'app.sqlite'),
  password = randomBytes(20).toString('hex');
async function start(secret) {
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: resolve('.'),
    windowsHide: true,
    env: {
      ...process.env,
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      NODE_ENV: 'test',
      PORT: String(port),
      API_HOST: '127.0.0.1',
      SPOKEMON_DB: db,
      SPOKEMON_ADMIN_LOGIN: 'deployment_admin',
      SPOKEMON_ADMIN_PASSWORD: secret,
      NODE_ENV: 'test',
      RENDER: 'true',
      RENDER_EXTERNAL_URL: base,
      COOKIE_SECURE: 'true'
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  child.stdout.on('data', b => output += b);
  child.stderr.on('data', b => output += b);
  for (let i = 0; i < 120; i++) {
    if (child.exitCode != null) throw Error('startup failed: ' + output);
    try {
      const res = await fetch(base + '/api/health');
      if (res.ok) return child;
    } catch {}
    await new Promise(r => setTimeout(r, 100));
  }
  child.kill();
  throw Error('startup timeout');
}
async function stop(child) {
  await new Promise(async resolve => {
    if (child.exitCode != null) return resolve();
    await child.once('exit', resolve);
    child.kill();
  });
}
async function login(secret) {
  return fetch(base + '/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Spokemon-Request': '1',
      Origin: base
    },
    body: JSON.stringify({
      login: 'deployment_admin',
      password: secret
    })
  });
}
let child = await start(password);
try {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Spokemon/);
  assert.equal((await fetch(base + '/images/pokeball-icon.png')).status, 200);
  const response = await login(password);
  assert.equal(response.status, 200);
  assert.match(await response.headers.get('set-cookie'), /Secure/);
  assert.equal((await response.json()).user.role, 'admin');
  await stop(child);
  child = await start('a-different-environment-password');
  assert.equal((await login(password)).status, 200);
  assert.equal((await login('a-different-environment-password')).status, 401);
  console.log('PASS: production entrypoint uses PORT, serves built SPA+favicon, creates first admin from environment, checks Render origin, sets Secure cookies and preserves admin credentials on restart.');
} finally {
  await stop(child);
}
