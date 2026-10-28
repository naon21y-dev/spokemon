import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
const file = join(mkdtempSync(join(tmpdir(), 'spokemon-partner-lock-')), 'test.sqlite'),
  password = randomBytes(18).toString('base64url');
let s = await createService(file);
const u = await s.createUser({
    login: 'partner_student',
    nickname: '파트너학생',
    password
  }),
  v = await s.createUser({
    login: 'second_student',
    nickname: '다른학생',
    password
  });
assert.equal((await s.state(u)).data.partnerLocked, false);
await s.updateProfile(u, {
  character: 'gengar'
});
assert.equal((await s.state(u)).data.partnerLocked, true);
assert.equal((await s.state(u)).data.pet.character, 'gengar');
await assert.rejects(async () => await s.updateProfile(u, {
  character: 'squirtle'
}), e => e.status === 400);
await s.updateProfile(u, {
  character: 'gengar'
});
await s.updateProfile(u, {
  nickname: '수정한이름'
});
assert.equal((await s.state(u)).user.nickname, '수정한이름');
assert.equal((await s.state(u)).data.pet.character, 'gengar');
assert.equal((await s.state(v)).data.partnerLocked, false);
const server = await createHttp(s);
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = 'http://127.0.0.1:' + server.address().port,
  session = await s.newSession(v),
  cookie = 'spokemon_session=' + session.token;
try {
  const results = await Promise.all(['piplup', 'squirtle', 'bulbasaur', 'gengar'].map(character => fetch(base + '/api/profile', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-Spokemon-Request': '1',
      Cookie: cookie
    },
    body: JSON.stringify({
      character
    })
  })));
  assert.equal(results.filter(r => r.status === 200).length, 1);
  assert.equal(results.filter(r => r.status === 400).length, 3);
  assert.equal((await s.state(v)).data.partnerLocked, true);
} finally {
  await new Promise(async r => await server.close(r));
  await s.close();
}
s = await createService(file);
assert.equal((await s.state(u)).data.pet.character, 'gengar');
assert.equal((await s.state(u)).data.partnerLocked, true);
await assert.rejects(async () => await s.updateProfile(u, {
  character: 'piplup'
}), e => e.status === 400);
await s.close();
// Upgrade an existing database without the flag: preserve and lock the chosen partner.
s = await createService(file);
s.db.exec('ALTER TABLE users DROP COLUMN partner_locked');
await s.close();
s = await createService(file);
assert.equal((await s.state(u)).data.pet.character, 'gengar');
assert.equal((await s.state(u)).data.partnerLocked, true);
const fresh = await s.createUser({
  login: 'new_after_upgrade',
  nickname: '신규학생',
  password
});
assert.equal((await s.state(fresh)).data.partnerLocked, false);
await s.close();
console.log('PASS: first choice locks, existing partners preserved, different-choice API denied, identical retries and nickname edits work, 4 concurrent choices select exactly once, restart and old-DB migration.');
