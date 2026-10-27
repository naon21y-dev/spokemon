import assert from 'node:assert/strict'
import {mkdtempSync,readFileSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {randomBytes} from 'node:crypto'
import {execFileSync} from 'node:child_process'
import {createService} from '../server/service.mjs'
const dir=mkdtempSync(join(tmpdir(),'spokemon-db-verify-')),file=join(dir,'test.sqlite'),password=randomBytes(24).toString('base64url')
const output=execFileSync(process.execPath,['server/create-admin.mjs','--login','persist_teacher','--name','검증 관리자'],{cwd:process.cwd(),env:{...process.env,SPOKEMON_DB:file,SPOKEMON_ADMIN_PASSWORD:password},encoding:'utf8'})
assert.ok(output.includes('관리자 계정을 생성'));assert.ok(!output.includes(password))
let s=createService(file);const teacher=s.login('persist_teacher',password),admin=s.authenticate(teacher.token),student=s.createUser({login:'persist_student',nickname:'기록보존학생',password}),session=s.newSession(student)
assert.notEqual(student.password,password);assert.ok(!readFileSync(file).includes(Buffer.from(password)))
s.migration(student,{legacyId:'old-persist-unique',progress:{coins:678,records:[{game:'이전 카드게임',coins:40,detail:'원본 이력 보존'}],learning:{history:[],mistakes:{}},pet:{character:'gengar',xp:320,owned:[],wear:'',hunger:80,happy:80,last:Date.now()}}});s.approveMigration(admin,student.id);const classInfo=s.createClass(admin,'보존반');s.assignClass(admin,student.id,classInfo.id);s.release(admin,{classId:classInfo.id,subject:'vue',maxUnit:1});s.complete(student,'vue-mc-01');s.close()
s=createService(file);assert.equal(s.authenticate(session.token).id,student.id);assert.equal(s.state(s.authenticate(session.token)).data.coins,678);assert.equal(s.summary(s.authenticate(session.token)).completed,1);s.approveMigration(s.authenticate(teacher.token),student.id);assert.equal(s.state(s.authenticate(session.token)).data.coins,678);const snapshot=s.studentDetail(s.authenticate(teacher.token),student.id).migration.snapshot;assert.equal(snapshot.records[0].detail,'원본 이력 보존');assert.equal(snapshot.pet.xp,320);s.close()
console.log('PASS: environment-only admin creation, password hash/no plaintext, file DB restart preserves sessions/roles/class/releases/coins/completion/legacy ledger+pet; approval replay does not add coins.')
