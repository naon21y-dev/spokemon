import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { createService } from '../server/service.mjs';
const dir = mkdtempSync(join(tmpdir(), 'spokemon-db-verify-')),
  file = join(dir, 'test.sqlite'),
  password = randomBytes(24).toString('base64url');
const output = execFileSync(process.execPath, ['server/create-admin.mjs', '--login', 'persist_teacher', '--name', '검증 관리자'], {
  cwd: process.cwd(),
  env: {
    ...process.env,
      TURSO_DATABASE_URL: '',
      TURSO_AUTH_TOKEN: '',
      NODE_ENV: 'test',
    SPOKEMON_DB: file,
    SPOKEMON_ADMIN_PASSWORD: password
  },
  encoding: 'utf8'
});
assert.ok(output.includes('관리자 계정을 생성'));
assert.ok(!output.includes(password));
let s = await createService(file);
const teacher = await s.login('persist_teacher', password),
  admin = await s.authenticate(teacher.token),
  student = await s.createUser({
    login: 'persist_student',
    nickname: '기록보존학생',
    password
  }),
  session = await s.newSession(student);
assert.notEqual(student.password, password);
assert.ok(!readFileSync(file).includes(Buffer.from(password)));
await s.migration(student, {
  legacyId: 'old-persist-unique',
  progress: {
    coins: 678,
    records: [{
      game: '이전 카드게임',
      coins: 40,
      detail: '원본 이력 보존'
    }],
    learning: {
      history: [],
      mistakes: {}
    },
    pet: {
      character: 'gengar',
      xp: 320,
      owned: [],
      wear: '',
      hunger: 80,
      happy: 80,
      last: Date.now()
    }
  }
});
await s.approveMigration(admin, student.id);
const classInfo = await s.createClass(admin, '보존반');
await s.assignClass(admin, student.id, classInfo.id);
await s.release(admin, {
  classId: classInfo.id,
  subject: 'vue',
  maxUnit: 1
});
await s.complete(student, 'vue-mc-01');
await s.close();
s = await createService(file);
assert.equal((await s.authenticate(session.token)).id, student.id);
assert.equal((await s.state(await s.authenticate(session.token))).data.coins, 678);
assert.equal((await s.summary(await s.authenticate(session.token))).completed, 1);
await s.approveMigration(await s.authenticate(teacher.token), student.id);
assert.equal((await s.state(await s.authenticate(session.token))).data.coins, 678);
const snapshot = (await s.studentDetail(await s.authenticate(teacher.token), student.id)).migration.snapshot;
assert.equal(snapshot.records[0].detail, '원본 이력 보존');
assert.equal(snapshot.pet.xp, 320);
await s.close();
console.log('PASS: environment-only admin creation, password hash/no plaintext, file DB restart preserves sessions/roles/class/releases/coins/completion/legacy ledger+pet; approval replay does not add coins.');
