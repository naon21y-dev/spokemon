import assert from 'node:assert/strict';
import { createService } from '../server/service.mjs';
import { items } from '../src/data/items.js';
const s = await createService(':memory:');
try {
  const u = await s.createUser({
    login: 'cost_student',
    nickname: '테스트',
    password: 'test-only-pass'
  });
  await s.updateProfile(u, {
    character: 'gengar'
  });
  await assert.rejects(async () => await s.updateProfile(u, {
    character: 'squirtle'
  }), e => e.status === 400);
  assert.equal((await s.state(u)).data.pet.character, 'gengar');
  await s.db.prepare('UPDATE users SET coins=5000 WHERE id=?').run(u.id);
  const before = (await s.state(u)).data.pet;
  await s.updateProfile(u, {
    character: 'squirtle'
  });
  assert.equal((await s.state(u)).data.coins, 0);
  assert.equal((await s.state(u)).data.pet.character, 'squirtle');
  assert.equal((await s.state(u)).data.pet.xp, before.xp);
  await s.updateProfile(u, {
    character: 'squirtle'
  });
  assert.equal((await s.db.prepare("SELECT count(*) AS n FROM ledger WHERE kind='파트너 변경'").get()).n, 1);
  await assert.rejects(async () => await s.updateProfile(u, {
    character: 'piplup'
  }), e => e.status === 400);
  assert.equal(items.length, 18);
  await s.db.prepare('UPDATE users SET coins=5000 WHERE id=?').run(u.id);
  for (const item of items) {
    const balance = (await s.state(u)).data.coins;
    await s.petAction(u, {
      action: 'wear',
      item: item.id
    });
    assert.equal((await s.state(u)).data.coins, balance - item.price);
    await s.petAction(u, {
      action: 'wear',
      item: item.id
    });
    assert.equal((await s.state(u)).data.coins, balance - item.price);
  }
  assert.equal((await s.state(u)).data.pet.owned.length, 18);
  await assert.rejects(async () => await s.petAction(u, {
    action: 'wear',
    item: 'fake'
  }));
  console.log('PASS: free first choice, 5000 point debit, insufficient funds rejected, retry no double debit, growth preserved, all 18 items server-priced and buy once.');
} finally {
  await s.close();
}
