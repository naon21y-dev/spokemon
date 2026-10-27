import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createService} from '../server/service.mjs'
import {createHttp} from '../server/http.mjs'
const file=join(mkdtempSync(join(tmpdir(),'spokemon-partner-lock-')),'test.sqlite'),password=randomBytes(18).toString('base64url');let s=createService(file)
const u=s.createUser({login:'partner_student',nickname:'파트너학생',password}),v=s.createUser({login:'second_student',nickname:'다른학생',password})
assert.equal(s.state(u).data.partnerLocked,false);s.updateProfile(u,{character:'gengar'});assert.equal(s.state(u).data.partnerLocked,true);assert.equal(s.state(u).data.pet.character,'gengar');assert.throws(()=>s.updateProfile(u,{character:'squirtle'}),e=>e.status===400);s.updateProfile(u,{character:'gengar'});s.updateProfile(u,{nickname:'수정한이름'});assert.equal(s.state(u).user.nickname,'수정한이름');assert.equal(s.state(u).data.pet.character,'gengar');assert.equal(s.state(v).data.partnerLocked,false)
const server=createHttp(s);await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port,session=s.newSession(v),cookie='spokemon_session='+session.token
try{const results=await Promise.all(['piplup','squirtle','bulbasaur','gengar'].map(character=>fetch(base+'/api/profile',{method:'PATCH',headers:{'Content-Type':'application/json','X-Spokemon-Request':'1',Cookie:cookie},body:JSON.stringify({character})})));assert.equal(results.filter(r=>r.status===200).length,1);assert.equal(results.filter(r=>r.status===400).length,3);assert.equal(s.state(v).data.partnerLocked,true)}finally{await new Promise(r=>server.close(r));s.close()}
s=createService(file);assert.equal(s.state(u).data.pet.character,'gengar');assert.equal(s.state(u).data.partnerLocked,true);assert.throws(()=>s.updateProfile(u,{character:'piplup'}),e=>e.status===400);s.close()
// Upgrade an existing database without the flag: preserve and lock the chosen partner.
s=createService(file);s.db.exec('ALTER TABLE users DROP COLUMN partner_locked');s.close();s=createService(file);assert.equal(s.state(u).data.pet.character,'gengar');assert.equal(s.state(u).data.partnerLocked,true);const fresh=s.createUser({login:'new_after_upgrade',nickname:'신규학생',password});assert.equal(s.state(fresh).data.partnerLocked,false);s.close()
console.log('PASS: first choice locks, existing partners preserved, different-choice API denied, identical retries and nickname edits work, 4 concurrent choices select exactly once, restart and old-DB migration.')
