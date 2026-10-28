import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,existsSync,mkdirSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {chromium} from 'playwright';
import {createService} from '../server/service.mjs';
import {createHttp} from '../server/http.mjs';
import {skins,activeSkin} from '../src/data/skins.js';
mkdirSync('artifacts',{recursive:true});const dir=mkdtempSync(join(process.cwd(),'artifacts','spokemon-skins-')),file=join(dir,'test.sqlite');
let service=await createService(file),server,browser;
try {
 assert.equal(skins.length,22);
 for(const skin of skins){assert.equal(skin.price,500);assert(existsSync('public'+skin.image));}
 const user=await service.createUser({login:'skin_student',nickname:'스킨학생',password:'test-only-pass'});
 await service.db.prepare('UPDATE users SET coins=20000,pet=?,partner_locked=1 WHERE id=?').run(JSON.stringify({...JSON.parse(user.pet),character:'gengar',xp:245,wear:'👑',owned:['👑']}),user.id);
 await Promise.all(Array.from({length:20},()=>service.petAction(user,{action:'skin',item:'gengar-01'})));
 let state=await service.state(user);assert.equal(state.data.coins,19500);assert.equal(activeSkin(state.data.pet).id,'gengar-01');assert.deepEqual(state.data.pet.ownedSkins,['gengar-01']);assert.equal(state.data.pet.xp,245);assert.equal(state.data.pet.wear,'👑');
 assert.equal((await service.db.prepare("SELECT COUNT(*) AS n FROM ledger WHERE user_id=? AND kind='스킨 구매'").get(user.id)).n,1);
 await service.petAction(user,{action:'skin',item:'default'});assert.equal(activeSkin((await service.state(user)).data.pet),null);
 await service.petAction(user,{action:'skin',item:'gengar-01'});assert.equal((await service.state(user)).data.coins,19500);
 await assert.rejects(()=>service.petAction(user,{action:'skin',item:'squirtle-01'}),e=>e.status===400);
 await assert.rejects(()=>service.petAction(user,{action:'skin',item:'fake'}),e=>e.status===400);
 const poor=await service.createUser({login:'skin_poor',nickname:'잔액학생',password:'test-only-pass'});
 await service.db.prepare('UPDATE users SET coins=499 WHERE id=?').run(poor.id);
 await assert.rejects(()=>service.petAction(poor,{action:'skin',item:'piplup-01'}),e=>e.status===400);
 assert.equal((await service.state(poor)).data.coins,499);assert.equal(activeSkin((await service.state(poor)).data.pet),null);
 const admin=await service.createUser({login:'skin_admin',nickname:'관리자',password:'test-only-pass',role:'admin'});
 await assert.rejects(()=>service.petAction(admin,{action:'skin',item:'piplup-01'}),e=>e.status===403);
 await service.db.close();service=await createService(file);assert.equal(activeSkin((await service.state(user)).data.pet).id,'gengar-01');
 const origins=[];server=await createHttp(service,{origins});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;origins.push(base);
 const guest=await fetch(base+'/api/pet',{method:'POST',headers:{'Content-Type':'application/json','x-spokemon-request':'1'},body:JSON.stringify({action:'skin',item:'gengar-01'})});assert.equal(guest.status,401);
 const session=await service.newSession(user);browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe'});
 const context=await browser.newContext({viewport:{width:1360,height:900}});await context.addCookies([{name:'spokemon_session',value:session.token,url:base}]);const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#/pet');await page.getByRole('button',{name:'만나기 시작',exact:true}).click();
 await page.locator('.pet-scene .scene-skin[data-skin="gengar-01"]').waitFor();
 assert((await page.locator('.device-partner-screen img').getAttribute('src')).endsWith('/gengar.png'));
 assert((await page.locator('.partner-wallet img').getAttribute('src')).endsWith('/gengar.png'));
 const boxBefore=await page.locator('.pet-scene').evaluate(e=>({height:e.getBoundingClientRect().height,bg:getComputedStyle(e).background,border:getComputedStyle(e).border,children:e.children.length}));
 await page.getByRole('button',{name:'✦ 스킨 상점 · 500 P',exact:true}).click();await page.getByRole('dialog',{name:'팬텀 스킨 상점'}).waitFor();assert.equal(await page.locator('.skin-option').count(),6);
 await page.getByRole('button',{name:/꿈꾸는 팬텀/}).click();await page.getByRole('button',{name:'500 P로 구매·적용',exact:true}).click();await page.getByRole('button',{name:'500 P 사용하고 구매 확정',exact:true}).click();await page.getByText('꿈꾸는 팬텀 적용 완료!',{exact:true}).waitFor();
 await page.getByRole('button',{name:'스킨 상점 닫기',exact:true}).click();await page.locator('.pet-scene .scene-skin[data-skin="gengar-02"]').waitFor();
 assert.deepEqual(await page.locator('.pet-scene').evaluate(e=>({height:e.getBoundingClientRect().height,bg:getComputedStyle(e).background,border:getComputedStyle(e).border,children:e.children.length})),boxBefore);
 assert((await page.locator('.device-partner-screen img').getAttribute('src')).endsWith('/gengar.png'));assert.equal(await page.locator('.scene-skin').count(),1);
 mkdirSync('artifacts',{recursive:true});await page.locator('.pet-scene').screenshot({path:'artifacts/skins-gengar-scene.png'});
 await page.reload();await page.getByRole('button',{name:'만나기 시작',exact:true}).click();await page.locator('.scene-skin[data-skin="gengar-02"]').waitFor();
 for(const character of ['squirtle','piplup','bulbasaur']) {
  await service.db.prepare('UPDATE users SET coins=20000 WHERE id=?').run(user.id);await service.updateProfile(user,{character});await service.petAction(user,{action:'skin',item:character+'-01'});
  await page.reload();await page.getByRole('button',{name:'만나기 시작',exact:true}).click();await page.locator('.scene-skin[data-skin="'+character+'-01"]').waitFor();
  assert((await page.locator('.device-partner-screen img').getAttribute('src')).endsWith('/'+character+'.png'));
 }
 await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'✦ 스킨 상점 · 500 P',exact:true}).click();await page.locator('.skin-shop[open]').waitFor();
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));const modal=await page.locator('.skin-shop').boundingBox();assert(modal.x>=0&&modal.x+modal.width<=392&&modal.y>=0&&modal.y+modal.height<=846);
 await page.screenshot({path:'artifacts/skins-shop-mobile.png'});await page.getByRole('button',{name:'스킨 상점 닫기',exact:true}).click();
 assert.deepEqual(errors,[]);console.log('PASS: 22 original skins, 500P atomic purchase (20 requests once), authorization, balance, ledger, persistence, free reuse, only scene center changes, panel/device/header preserved, mobile modal.');
} finally {await browser?.close();if(server)await new Promise(r=>server.close(r));await service.db.close();try{rmSync(dir,{recursive:true,force:true,maxRetries:5,retryDelay:200})}catch(e){console.warn('Temporary test DB cleanup:',e.code)}}

