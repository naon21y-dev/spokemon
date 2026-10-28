import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {createCardGame} from '../server/card-game.mjs';
import {createActivity} from '../server/activity.mjs';
import {createSocial} from '../server/social.mjs';
import {cardLevels} from '../src/data/card-levels.js';
const service=await createService(':memory:'),password='test-only-pass';let server,browser;
try{
 const a=await service.createUser({login:'card_user',nickname:'카드학생',password}),b=await service.createUser({login:'receiver_user',nickname:'받는학생',password}),c=await service.createUser({login:'sender_user',nickname:'보낸학생',password}),admin=await service.createUser({login:'test_admin',nickname:'관리자',password,role:'admin'});
 await service.points.grant(admin,b.id,{amount:40,reason:'배포 이전 내역',requestKey:randomUUID()});
 const cards=await createCardGame(service),activity=await createActivity(service),social=await createSocial(service);
 assert.equal((await activity.list(b)).events.length,0);
 await social.add(a,b.id);let events=(await activity.list(b)).events;assert.equal(events.length,1);assert.equal(events[0].senderId,a.id);assert.equal((await activity.list(a)).events.length,0);
 await activity.acknowledge(a,{ids:[events[0].id]});assert.equal((await activity.list(b)).events.length,1);await activity.acknowledge(b,{ids:[events[0].id]});assert.equal((await activity.list(b)).events.length,0);
 await assert.rejects(()=>cards.start(b,{level:9,requestKey:randomUUID()}),e=>e.status===400);await assert.rejects(()=>cards.start(admin,{level:1,requestKey:randomUUID()}),e=>e.status===403);
 assert.deepEqual(cardLevels.map(l=>l.reward),[3,5,10,15,20,25,30,50]);
 for(const level of cardLevels){
  const requestKey=randomUUID(),game=await cards.start(a,{level:level.id,requestKey});assert.equal((await cards.start(a,{level:level.id,requestKey})).id,game.id);assert.equal(game.cards.length,level.pairs*2);assert(game.cards.every(v=>v===null));
  await assert.rejects(()=>cards.flip(b,game.id,{index:0}),e=>e.status===404);await assert.rejects(()=>cards.flip(a,game.id,{index:999,done:true}),e=>e.status===400);
  const raw=JSON.parse((await service.db.prepare('SELECT state FROM card_sessions WHERE id=?').get(game.id)).state),pairs=[];
  const grouped=Map.groupBy(raw.deck.map((face,index)=>({face,index})),v=>v.face);for(const group of grouped.values())for(let i=0;i<group.length;i+=2)pairs.push([group[i].index,group[i+1].index]);
  let result;for(const pair of pairs){await cards.flip(a,game.id,{index:pair[0]});result=await cards.flip(a,game.id,{index:pair[1]})}assert(result.done);assert.equal(result.reward,level.reward);
  await Promise.all(Array.from({length:20},()=>cards.flip(a,game.id,{index:pairs.at(-1)[1]})));
  assert.equal((await service.db.prepare('SELECT COUNT(*) n FROM ledger WHERE unique_key=?').get('card-clear:'+game.id)).n,1);
 }
 assert.equal((await service.state(a)).data.coins,158);assert.equal((await activity.list(a)).events.filter(e=>e.kind==='points').length,8);
 const origins=[];server=await createHttp(service,{origins});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;origins.push(base);
 const unauth=await fetch(base+'/api/activity/notifications');assert.equal(unauth.status,401);
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1360,height:900}}),token=(await service.newSession(b)).token;await context.addCookies([{name:'spokemon_session',value:token,url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await social.add(c,b.id);await page.goto(base+'/#/cards');const alert=page.getByRole('dialog',{name:'친구 요청 알림',exact:true});await alert.waitFor();await alert.getByText('보낸학생',{exact:true}).waitFor();await alert.getByRole('button',{name:'친구 요청 수락',exact:true}).click();await alert.waitFor({state:'hidden'});assert((await social.list(b)).friends.some(f=>f.id===c.id&&f.accepted));
 assert.equal(await page.locator('nav').getByRole('link',{name:'홈',exact:true}).count(),0);assert.equal(await page.locator('.card-level-chip').count(),8);assert.equal(await page.locator('a.brand').getAttribute('href'),'#/home');
 await service.points.grant(admin,b.id,{amount:10,reason:'새로운 보너스',requestKey:randomUUID()});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));const points=page.getByRole('dialog',{name:'포인트 수령 알림',exact:true});await points.waitFor();await points.getByText('+10 P',{exact:true}).waitFor();await points.getByRole('button',{name:'확인',exact:true}).click();await points.waitFor({state:'hidden'});
 await page.reload();await page.locator('.card-level-chip').first().waitFor();assert.equal(await page.locator('.activity-popup[open]').count(),0);
 await page.getByRole('button',{name:'START',exact:true}).click();await page.locator('.tcg-card').first().waitFor();assert.equal(await page.locator('.tcg-card').count(),8);
 const row=await service.db.prepare('SELECT * FROM card_sessions WHERE user_id=? ORDER BY created_at DESC LIMIT 1').get(b.id),deck=JSON.parse(row.state).deck,first=0,wrong=deck.findIndex(v=>v!==deck[first]);
 await page.locator('.tcg-card').nth(first).click();await page.locator('.tcg-card').nth(wrong).click();await page.waitForFunction(()=>document.querySelectorAll('.tcg-card.revealed').length===0);
 for(const group of Map.groupBy(deck.map((face,index)=>({face,index})),v=>v.face).values())for(let i=0;i<group.length;i+=2){await page.locator('.tcg-card').nth(group[i].index).click();await page.locator('.tcg-card').nth(group[i+1].index).click()}
 await points.waitFor();await points.getByText('+3 P',{exact:true}).waitFor();await points.getByRole('button',{name:'확인',exact:true}).click();await page.getByText('🪙 +3코인 지급 완료!',{exact:true}).waitFor();
 await page.getByRole('button',{name:'다음 레벨 →',exact:true}).click();await page.getByRole('combobox',{name:'게임 레벨',exact:true}).selectOption('8');await page.waitForFunction(()=>document.querySelectorAll('.tcg-card').length===48);
 mkdirSync('artifacts',{recursive:true});await page.waitForTimeout(400);await page.screenshot({path:'artifacts/cards-level8-desktop.png'});await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('.viewport-card-grid').getBoundingClientRect().width<=390);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));await page.screenshot({path:'artifacts/cards-level8-mobile.png'});
 await page.locator('a.brand').click();await page.waitForURL(url=>url.hash==='#/');await page.goto(base+'/#/cards');await page.locator('.card-game-intro').waitFor();
 await service.createUser({login:'new_friend',nickname:'새친구학생',password});await page.goto(base+'/#/pet/mailbox?tab=friends');await page.getByRole('button',{name:'친구 찾기',exact:true}).click();await page.getByLabel('친구 아이디 검색').fill('new_friend');await page.getByRole('button',{name:'검색',exact:true}).click();await page.getByRole('button',{name:'친구 추가',exact:true}).click();const sent=page.getByRole('dialog',{name:'친구 요청 전송 완료',exact:true});await sent.waitFor();await sent.getByRole('button',{name:'확인',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS: 8 levels / 48 cards, exact rewards total 158, 20 duplicate clears pay once per round, hidden deck, ownership/auth, request and points popups with receipts, sender confirmation, mismatch reset, mobile fit, home nav removed, logo link, re-entry reset.');
}finally{await browser?.close();if(server)await new Promise(r=>server.close(r));await service.db.close()}
