import assert from 'node:assert/strict'
import {createService} from '../server/service.mjs'
import {items} from '../src/data/items.js'
const s=createService(':memory:');try{
const u=s.createUser({login:'cost_student',nickname:'테스트',password:'test-only-pass'});s.updateProfile(u,{character:'gengar'});
assert.throws(()=>s.updateProfile(u,{character:'squirtle'}),e=>e.status===400);assert.equal(s.state(u).data.pet.character,'gengar');
s.db.prepare('UPDATE users SET coins=5000 WHERE id=?').run(u.id);const before=s.state(u).data.pet;s.updateProfile(u,{character:'squirtle'});assert.equal(s.state(u).data.coins,0);assert.equal(s.state(u).data.pet.character,'squirtle');assert.equal(s.state(u).data.pet.xp,before.xp);s.updateProfile(u,{character:'squirtle'});assert.equal(s.db.prepare("SELECT count(*) AS n FROM ledger WHERE kind='파트너 변경'").get().n,1);assert.throws(()=>s.updateProfile(u,{character:'piplup'}),e=>e.status===400);
assert.equal(items.length,18);s.db.prepare('UPDATE users SET coins=5000 WHERE id=?').run(u.id);for(const item of items){const balance=s.state(u).data.coins;s.petAction(u,{action:'wear',item:item.id});assert.equal(s.state(u).data.coins,balance-item.price);s.petAction(u,{action:'wear',item:item.id});assert.equal(s.state(u).data.coins,balance-item.price)}assert.equal(s.state(u).data.pet.owned.length,18);assert.throws(()=>s.petAction(u,{action:'wear',item:'fake'}));console.log('PASS: free first choice, 5000 point debit, insufficient funds rejected, retry no double debit, growth preserved, all 18 items server-priced and buy once.')
}finally{s.close()}
