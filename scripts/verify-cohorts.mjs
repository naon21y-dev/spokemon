import assert from 'node:assert/strict'
import {randomBytes} from 'node:crypto'
import {mkdtempSync} from 'node:fs'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import {createService,unitOf} from '../server/service.mjs'
import {questionMap} from '../server/questions/index.js'
const file=join(mkdtempSync(join(tmpdir(),'spokemon-cohorts-')),'cohort.sqlite'),password=randomBytes(18).toString('base64url')
let s=createService(file)
const admin=s.createUser({login:'cohort_teacher',password,nickname:'기수관리자',role:'admin'}),student=s.createUser({login:'cohort_student',password,nickname:'기수학생'}),cohort=s.createClass(admin,'27기')
s.assignClass(admin,student.id,cohort.id)
assert.throws(()=>s.createClass(student,'우회기수'),e=>e.status===403)
assert.throws(()=>s.release(student,{classId:cohort.id,subject:'vue',units:[1,3]}),e=>e.status===403)
s.release(admin,{classId:cohort.id,subject:'vue',units:[3,1,1]})
let catalog=s.catalog(student).find(x=>x.id==='vue');assert.deepEqual(catalog.releasedUnits,[1,3]);assert.equal(catalog.total,40);assert.equal(catalog.units[1].locked,true);assert.equal(catalog.units[2].locked,false)
assert.throws(()=>s.lesson(student,'vue',2),e=>e.status===403);assert.throws(()=>s.startQuiz(student,{subject:'vue',type:'all',unit:2}),e=>e.status===403)
const quiz=s.startQuiz(student,{subject:'vue',type:'all'});assert.ok(quiz.questionIds.every(id=>[1,3].includes(unitOf(questionMap[id]))));assert.equal(quiz.questionIds.length,25)
s.complete(student,'vue-mc-25');assert.equal(s.summary(student).completed,1)
s.release(admin,{classId:cohort.id,subject:'vue',units:[1]});assert.equal(s.summary(student).total,20);assert.equal(s.summary(student).completed,0);assert.throws(()=>s.getQuiz(student,quiz.id),e=>e.status===403)
s.release(admin,{classId:cohort.id,subject:'vue',units:[1,3]});assert.equal(s.summary(student).completed,1)
s.release(admin,{classId:cohort.id,subject:'vue',units:[]});assert.equal(s.summary(student).total,0);assert.equal(s.summary(student).percent,0)
for(const invalid of [[0],[6],['1'],null])assert.throws(()=>s.release(admin,{classId:cohort.id,subject:'vue',units:invalid}),e=>e.status===400)
// Simulate an old cumulative release with no checkbox record, then restart.
s.db.prepare('INSERT INTO releases VALUES (?,?,?)').run(cohort.id,'python',3);s.close();s=createService(file)
assert.deepEqual(s.catalog(student).find(x=>x.id==='python').releasedUnits,[1,2,3]);assert.deepEqual(s.catalog(student).find(x=>x.id==='vue').releasedUnits,[])
s.release(admin,{classId:cohort.id,subject:'vue',units:[3,5]});s.close();s=createService(file);assert.deepEqual(s.catalog(student).find(x=>x.id==='vue').releasedUnits,[3,5]);assert.equal(s.summary(student).completed,1);s.close()
console.log('PASS: admin-only cohort creation/assignment, independent [1,3] releases, locked gaps and quiz API enforcement, denominator/relock preservation, empty selection, legacy migration and DB restart.')
