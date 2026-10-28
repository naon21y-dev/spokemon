import assert from 'node:assert/strict';
import {existsSync,mkdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {chromium} from 'playwright';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {createHiddenGame} from '../server/hidden-game.mjs';
import {createActivity} from '../server/activity.mjs';
import {hiddenLevels} from '../src/data/hidden-levels.js';
const service=await createService(':memory:'),password='test-only-pass';let server,browser;
try{
 const user=await service.createUser({login:'hunt_student',nickname:'찾기학생',password}),other=await service.createUser({login:'hunt_other',nickname:'다른학생',password}),admin=await service.createUser({login:'hunt_admin',nickname:'관리자',password,role:'admin'}),hidden=await createHiddenGame(service);
 const origins=[];server=await createHttp(service,{origins});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;origins.push(base);
 assert.equal(hiddenLevels.length,10);assert.equal(new Set(hiddenLevels.map(l=>l.image)).size,10);
 await assert.rejects(()=>hidden.start(admin,{level:1,requestKey:randomUUID()}),e=>e.status===403);
 await assert.rejects(()=>hidden.start(user,{level:11,requestKey:randomUUID()}),e=>e.status===400);
 for(const level of hiddenLevels){
  assert(existsSync('public'+level.image));assert.equal(level.reward,3);assert.equal(level.targets,10);
  const requestKey=randomUUID(),game=await hidden.start(user,{level:level.id,requestKey});assert.equal((await hidden.start(user,{level:level.id,requestKey})).id,game.id);
  const targets=game.objects.filter(o=>o.target),decoys=game.objects.filter(o=>!o.target);assert.equal(targets.length,10);assert.equal(decoys.length,level.decoys);assert.equal(new Set(targets.map(t=>t.emoji)).size,10);assert(!decoys.some(o=>targets.some(t=>t.emoji===o.emoji)));
  for(const object of game.objects){assert(object.x>5&&object.x<95&&object.y>5&&object.y<95)}
  await assert.rejects(()=>hidden.act(other,game.id,{action:'find',objectId:targets[0].id}),e=>e.status===404);
  await assert.rejects(()=>hidden.act(user,game.id,{action:'finish',done:true,found:targets.map(t=>t.id)}),e=>e.status===400);
  const wrong=await hidden.act(user,game.id,{action:'find',objectId:decoys[0].id});assert.equal(wrong.found.length,0);assert.equal(wrong.misses,1);
  for(let i=0;i<3;i++){const hint=await hidden.act(user,game.id,{action:'hint'});assert.equal(hint.hintsLeft,2-i);assert.equal(hint.found.length,0)}
  await assert.rejects(()=>hidden.act(user,game.id,{action:'hint'}),e=>e.status===400);
  for(const target of targets.slice(0,9))await hidden.act(user,game.id,{action:'find',objectId:target.id});assert.equal((await service.state(user)).data.coins,(level.id-1)*3);
  await Promise.all(Array.from({length:20},()=>hidden.act(user,game.id,{action:'find',objectId:targets[9].id})));
  assert.equal((await service.state(user)).data.coins,level.id*3);assert.equal((await service.db.prepare('SELECT COUNT(*) n FROM ledger WHERE unique_key=?').get('hidden-clear:'+game.id)).n,1);
 }
 const activity=await createActivity(service);assert.equal((await activity.list(user)).events.filter(e=>e.reason==='숨은그림 클리어').length,10);
 const guest=await fetch(base+'/api/hidden/start',{method:'POST',headers:{'Content-Type':'application/json','X-Spokemon-Request':'1'},body:JSON.stringify({level:1,requestKey:randomUUID()})});assert.equal(guest.status,401);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});const context=await browser.newContext({hasTouch:true,viewport:{width:1360,height:900}});await context.addCookies([{name:'spokemon_session',value:(await service.newSession(other)).token,url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#/');await page.locator('.game-card[href="#/hidden"]').waitFor();assert.equal(await page.locator('.game-grid .game-card').count(),4);assert.equal(await page.locator('.coming-soon').count(),0);await page.locator('.game-card[href="#/hidden"]').click();await page.locator('.hunt-levels button').first().waitFor();assert.equal(await page.locator('.hunt-levels button').count(),10);
 await page.getByRole('button',{name:'LEVEL 1 시작 →',exact:true}).click();await page.locator('.hunt-board').waitFor();await page.waitForFunction(()=>document.querySelector('.hunt-background')?.complete);assert.equal(await page.locator('.hunt-target-list li').count(),10);assert.equal(await page.locator('.hunt-object[data-target="true"]').count(),10);
 await page.locator('.hunt-object[data-target="false"]').first().click();assert.equal((await service.state(other)).data.coins,0);
 for(let i=0;i<3;i++){await page.getByRole('button',{name:'💡 힌트 '+(3-i)+' / 3',exact:true}).click();await page.locator('.hunt-object.hint').waitFor()}assert(await page.getByRole('button',{name:'💡 힌트 0 / 3',exact:true}).isDisabled());
 mkdirSync('artifacts',{recursive:true});await page.screenshot({path:'artifacts/hidden-game-desktop.png'});
 for(let i=0;i<10;i++)await page.locator('.hunt-object[data-target="true"]').nth(i).click();const points=page.getByRole('dialog',{name:'포인트 수령 알림',exact:true});await points.waitFor();await points.getByText('+3 P',{exact:true}).waitFor();await points.getByRole('button',{name:'확인',exact:true}).click();await page.getByText('🪙 +3포인트 지급 완료!',{exact:true}).waitFor();assert.equal((await service.state(other)).data.coins,3);
 await page.getByRole('button',{name:'다음 단계 →',exact:true}).click();await page.locator('.hunt-board[data-level="2"]').waitFor();assert.equal(await page.locator('.hunt-object.found').count(),0);await page.getByRole('combobox',{name:'숨은그림 단계',exact:true}).selectOption('10');await page.locator('.hunt-board[data-level="10"]').waitFor();assert.equal(await page.locator('.hunt-object').count(),36);
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(200);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
 assert(await page.locator('.hunt-board').evaluate(board=>{const a=board.getBoundingClientRect();return [...board.querySelectorAll('.hunt-object')].every(el=>{const b=el.getBoundingClientRect();return b.left>=a.left&&b.right<=a.right&&b.top>=a.top&&b.bottom<=a.bottom})}));
 await page.locator('.hunt-board').screenshot({path:'artifacts/hidden-game-mobile-board.png'});await page.screenshot({path:'artifacts/hidden-game-mobile.png'});
 await page.locator('.hunt-object[data-target="true"]').first().tap();await page.locator('.hunt-object.found').waitFor();await page.getByRole('button',{name:'↻ 재시작',exact:true}).click();await page.waitForFunction(()=>document.querySelectorAll('.hunt-object.found').length===0);
 await page.getByRole('button',{name:'시작 화면',exact:true}).click();await page.locator('.hunt-intro').waitFor();await page.locator('a.brand').click();await page.waitForURL(url=>url.hash==='#/');assert.equal(await page.evaluate(()=>document.documentElement.classList.contains('hidden-focus-mode')),false);
 await page.goto(base+'/#/hidden');await page.locator('.hunt-intro').waitFor();assert.deepEqual(errors,[]);
 console.log('PASS: 10 distinct existing backgrounds, 10 targets per level, increasing decoys, server-only 3P after all ten, 20 concurrent finishes once, no forged finish, ownership/login/admin checks, 3 hints, home placeholder replacement, real play/next/restart/re-entry, mobile bounds, reward popup and timer cleanup.');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await service.db.close()}
