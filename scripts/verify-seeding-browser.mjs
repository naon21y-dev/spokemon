import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {seedingQuestions} from '../server/questions/seeding.js';
const s=await createService(':memory:'),origins=[],server=await createHttp(s,{origins});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;origins.push(base);
const browser=await chromium.launch({headless:true,...(existsSync('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe')?{executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'}:{})});
const errors=[];mkdirSync('artifacts/seeding',{recursive:true});
try{
 const password=randomUUID(),admin=await s.createUser({login:'ui_seed_admin',nickname:'관리자',password,role:'admin'}),student=await s.createUser({login:'ui_seed_student',nickname:'1시드도전자',password});
 await s.attendance.checkIn(student);
 async function pageFor(u){const context=await browser.newContext({viewport:{width:1366,height:900}});await context.addCookies([{name:'spokemon_session',value:(await s.newSession(u)).token,url:base}]);const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));return p}
 const studentPage=await pageFor(student),adminPage=await pageFor(admin);
 await studentPage.goto(base+'/#/seeding');
 const popup=studentPage.locator('.activity-popup[open]');await popup.waitFor();assert.match(await popup.innerText(),/열심히 해서 1시드/);await popup.getByRole('button',{name:'1시드 도전하기!'}).click();await popup.waitFor({state:'hidden'});
 await studentPage.getByRole('button',{name:'30문제 도전 시작!'}).click();await studentPage.locator('.seed-question').last().waitFor();assert.equal(await studentPage.locator('.seed-question').count(),30);assert.equal(await studentPage.locator('.seed-question input').count(),30);
 const answers=new Map(seedingQuestions.map(q=>[q.id,q.acceptedAnswers[0]]));
 const inputs=studentPage.locator('.seed-question input');const first=inputs.first();await first.fill(answers.get(await first.getAttribute('id')));
 await studentPage.getByRole('button',{name:'지금 저장'}).click();await studentPage.getByText('자동 저장 완료',{exact:true}).waitFor();const firstId=await first.getAttribute('id');await studentPage.reload();await studentPage.locator('#'+firstId).waitFor();assert.equal(await studentPage.locator('#'+firstId).inputValue(),answers.get(firstId));
 for(const width of [1366,390,320]){await studentPage.setViewportSize({width,height:900});assert(await studentPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'page overflow at '+width);assert(await studentPage.locator('.seed-question').evaluateAll(els=>els.every(e=>e.scrollWidth<=e.clientWidth+1)),'question parent overflow at '+width);await studentPage.screenshot({path:`artifacts/seeding/form-${width}.png`,fullPage:false})}
 await studentPage.getByRole('button',{name:'☰ 메뉴'}).click();const link=studentPage.locator('.seeding-sparkle');await link.waitFor();assert.match(await link.innerText(),/GT's seeding/);await studentPage.screenshot({path:'artifacts/seeding/sidebar-mobile.png'});await studentPage.getByRole('button',{name:'메뉴 닫기',exact:true}).click();
 await studentPage.setViewportSize({width:1366,height:900});
 for(let i=0;i<30;i++){const input=inputs.nth(i);await input.fill(i===29?'일부러 틀린 답':answers.get(await input.getAttribute('id')))}
 const balance=(await s.state(student)).data.coins;
 await studentPage.getByRole('button',{name:'30문제 한꺼번에 제출 · 500P 받기'}).click();await studentPage.getByRole('heading',{name:'30문제 도전 완료! +500P'}).waitFor();assert.match(await studentPage.locator('.seed-result').innerText(),/29 \/ 30문제/);assert.equal((await s.state(student)).data.coins,balance+500);assert.equal(await studentPage.locator('.seed-feedback').count(),30);
 // Clear the ordinary point receipt before checking the independent announcement popup.
 const points=studentPage.locator('.activity-popup[open]');if(await points.isVisible())await points.getByRole('button',{name:'확인',exact:true}).click();
 await adminPage.goto(base+'/#/admin?section=seeding');await adminPage.getByRole('heading',{name:"✨ GT's seeding 공개 설정"}).waitFor();await adminPage.getByRole('button',{name:'공개 중 · 숨기기',exact:true}).click();await adminPage.getByRole('button',{name:'숨김 중 · 공개하기',exact:true}).waitFor();await studentPage.reload();await studentPage.getByRole('heading',{name:'지금은 준비 중이에요.'}).waitFor();await studentPage.getByRole('button',{name:'☰ 메뉴'}).click();assert.equal(await studentPage.locator('.seeding-sparkle').count(),0);await studentPage.getByRole('button',{name:'메뉴 닫기',exact:true}).click();
 await adminPage.getByRole('button',{name:'숨김 중 · 공개하기',exact:true}).click();await adminPage.getByRole('button',{name:'공개 중 · 숨기기',exact:true}).waitFor();
 await adminPage.goto(base+'/#/sloud');await adminPage.getByRole('button',{name:'＋ 글쓰기'}).click();await adminPage.getByLabel('제목',{exact:true}).fill('시험 대비 공지 UI 검증');await adminPage.getByLabel('내용',{exact:true}).fill('GT\'s seeding에서 함께 공부해요!');await adminPage.getByRole('button',{name:'공유하기',exact:true}).click();await adminPage.getByRole('heading',{name:'시험 대비 공지 UI 검증'}).waitFor();
 await studentPage.reload();await popup.waitFor();if((await popup.innerText()).includes("GT's seeding OPEN!")){await popup.getByRole('button',{name:'닫기',exact:true}).click()}
 await popup.getByRole('heading',{name:'Sloud 공지사항'}).waitFor();await studentPage.setViewportSize({width:320,height:850});assert(await popup.evaluate(e=>e.getBoundingClientRect().right<=innerWidth&&e.getBoundingClientRect().left>=0));await studentPage.screenshot({path:'artifacts/seeding/notice-mobile.png'});await popup.getByRole('button',{name:'공지 확인하기'}).click();await studentPage.getByRole('heading',{name:'시험 대비 공지 UI 검증'}).waitFor();assert.match(await studentPage.locator('.sloud-section-label').innerText(),/공지사항/);
 assert.deepEqual(errors,[]);console.log('PASS browser: live 30-question form, draft reload, 29/30 result and 500P, admin hide/reopen, sidebar visibility, Sloud announcement popup navigation, 1366/390/320px parent/page overflow, no JS errors. Screenshots: artifacts/seeding.');
}catch(e){for(const [i,p] of browser.contexts().flatMap(c=>c.pages()).entries()){await p.screenshot({path:'artifacts/seeding/failure-'+i+'.png'});console.log('PAGE',i,p.url(),(await p.locator('body').innerText()).slice(-5000))}console.log('JS ERRORS',errors);throw e}finally{await browser.close();await new Promise(r=>server.close(r));await s.close()}
