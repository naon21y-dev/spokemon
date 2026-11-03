import {runPython} from '../server/dungeon/python.mjs';
const result=await runPython({code:'def check(n):\n    return n + 1',entry:'check',tests:[{args:[2],expected:3}]});
if(!result.limits||!result.results?.[0]?.correct)throw Error('Python dungeon isolated judge is unavailable; refusing this build.');
console.log('Python dungeon runtime ready: process isolation, 128MB memory and 2s CPU/wall limits.');

import {runSQL} from '../server/detective/sql.mjs';
import {makeCase} from '../server/detective/questions.mjs';
const c=makeCase(5),q=c.questions[3];
const sql=await runSQL({fixture:c.fixture,reference:q.sql,sql:q.sql,requiredTables:q.requiredTables});
if(!sql.correct)throw Error('SQL detective isolated judge unavailable; refusing this build.');
console.log('SQL detective runtime ready: generated in-memory tables, read-only authorizer, operation/time/memory limits.');
