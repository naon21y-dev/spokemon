import {runPython} from '../server/dungeon/python.mjs';
const result=await runPython({code:'def check(n):\n    return n + 1',entry:'check',tests:[{args:[2],expected:3}]});
if(!result.limits||!result.results?.[0]?.correct)throw Error('Python dungeon isolated judge is unavailable; refusing this build.');
console.log('Python dungeon runtime ready: process isolation, 128MB memory and 2s CPU/wall limits.');
