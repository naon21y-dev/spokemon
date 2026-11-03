import {randomInt} from 'node:crypto';
import {ensureEnhancement} from './evolution.mjs';
import {hydrateCollection} from './collection.mjs';
import {characters} from '../src/data/characters.js';
import {fail} from './service.mjs';

const species = [
  ['zapdos', '썬더', '전기 · 비행'],
  ['moltres', '파이어', '불꽃 · 비행'],
  ['articuno', '프리져', '얼음 · 비행'],
  ['lugia', '루기아', '에스퍼 · 비행'],
  ['palkia', '펄기아', '물 · 드래곤'],
  ['ho-oh', '칠색조', '불꽃 · 비행'],
  ['dialga', '디아루가', '강철 · 드래곤'],
  ['arceus', '아르세우스', '노말'],
];
const catalog = new Map(species.map(([key,name,type]) => {
  const id = 'legendary-' + key;
  return [id, {id,name,type,legendary:true,stage:1,formId:id,
    image:'/api/legendary/art/'+key+'/base',
    skin:{id:id+'-shiny',character:id,stage:1,name:'이로치 '+name,price:500,image:'/api/legendary/art/'+key+'/shiny'},
  }];
}));
const finalId = 'legendary-arceus';
const regularIds = [...catalog.keys()].filter(id => id !== finalId);
export const legendarySkin = (character, id) => {
  const skin = catalog.get(character)?.skin;
  return skin?.id === id ? skin : undefined;
};

export async function createLegendary(service, {roll=randomInt}={}) {
  const db = service.db;
  const get = (sql,...args) => db.prepare(sql).get(...args);
  const all = (sql,...args) => db.prepare(sql).all(...args);
  const run = (sql,...args) => db.prepare(sql).run(...args);
  await db.exec(`
    CREATE TABLE IF NOT EXISTS legendary_owned(
      user_id TEXT NOT NULL REFERENCES users(id),
      species TEXT NOT NULL,
      captured_at INTEGER NOT NULL,
      PRIMARY KEY(user_id,species)
    );
    CREATE TABLE IF NOT EXISTS legendary_claims(
      user_id TEXT NOT NULL REFERENCES users(id),
      request_key TEXT NOT NULL,
      species TEXT NOT NULL,
      PRIMARY KEY(user_id,request_key)
    );
  `);
  async function account(u) {
    service.student(u);
    const row = await get('SELECT * FROM users WHERE id=? AND deleted_at IS NULL',u.id);
    if (!row) fail(401,'로그인이 필요해요.');
    return row;
  }
  async function ownership(u) {
    return new Set((await all('SELECT species FROM legendary_owned WHERE user_id=? ORDER BY captured_at,rowid',u.id)).map(row=>row.species));
  }
  async function requirements(u) {
    const book = await service.quests.list(u);
    const quests = book.units.filter(unit=>unit.total>0).flatMap(unit=>unit.quests);
    const metQuests = quests.filter(quest=>quest.progress>=quest.target).length;
    const dungeon = (await get('SELECT COUNT(*) AS n FROM dungeon_awards WHERE user_id=? AND level BETWEEN 1 AND 5',u.id)).n;
    const detective = (await get('SELECT COUNT(*) AS n FROM detective_awards WHERE user_id=? AND level BETWEEN 1 AND 5',u.id)).n;
    const posts = (await get('SELECT COUNT(*) AS n FROM workshop_posts WHERE author_id=? AND published=1',u.id)).n;
    const study = (await get('SELECT COALESCE(SUM(ms),0) AS n FROM study_days WHERE user_id=?',u.id)).n;
    const collection = await hydrateCollection(db,u,JSON.parse(u.pet));
    const partners = characters.filter(character=>collection[character.id]).length + Number(!!collection['diglett:diglett']);
    return [
      {id:'quests',label:'모든 퀘스트 목표 달성',done:quests.length>0&&metQuests===quests.length,progress:metQuests,total:quests.length},
      {id:'dungeon',label:'Python 코딩 던전 5레벨 클리어',done:dungeon===5,progress:dungeon,total:5},
      {id:'detective',label:'SQL 미스터리 탐정단 5단계 클리어',done:detective===5,progress:detective,total:5},
      {id:'workshop',label:'문제 제작소에 문제 공개 등록',done:posts>0,progress:Math.min(posts,1),total:1},
      {id:'quiz',label:'퀴즈 타임 공식 문제 모두 제출',done:book.quiz.total>0&&book.quiz.attempted===book.quiz.total,progress:book.quiz.attempted,total:book.quiz.total},
      {id:'study',label:'누적 공부시간 2시간 초과',done:study>7200000,minutes:Math.floor(study/60000)},
      {id:'partners',label:'일반 포켓몬 7종 모으기',done:partners>=7,progress:Math.min(partners,7),total:7},
    ];
  }
  async function read(u) {
    return db.transaction(async()=>{
      const user = await account(u);
      const owned = await ownership(user);
      const checks = await requirements(user);
      const entries = [...owned].filter(id=>regularIds.includes(id)).map(id=>catalog.get(id));
      return {entries, total:regularIds.length, checks, current:JSON.parse(user.pet).character,
        canDraw:entries.length<regularIds.length&&checks.every(check=>check.done),
        canClaimFinal:entries.length===regularIds.length&&!owned.has(finalId),
        final:owned.has(finalId)?catalog.get(finalId):null};
    });
  }
  async function claim(u, body) {
    const key = body?.requestKey;
    if (typeof key!=='string'||!/^[-\w]{8,100}$/.test(key)) fail(400,'수령 요청을 확인해 주세요.');
    if (!['draw','final'].includes(body.kind)) fail(400,'수령 종류를 확인해 주세요.');
    return db.transaction(async()=>{
      const user = await account(u);
      const receipt = await get('SELECT species FROM legendary_claims WHERE user_id=? AND request_key=?',user.id,key);
      if (receipt) {
        if ((receipt.species===finalId)!==(body.kind==='final')) fail(409,'수령 종류가 달라요.');
        return {pokemon:catalog.get(receipt.species)};
      }
      const owned = await ownership(user);
      const remaining = regularIds.filter(id=>!owned.has(id));
      let id;
      if (body.kind==='final') {
        if (remaining.length||owned.has(finalId)) fail(403,'전설 도감의 7칸을 먼저 채워 주세요.');
        id = finalId;
      } else {
        if (!remaining.length) fail(409,'전설 포켓몬 7종을 모두 모았어요.');
        if (!(await requirements(user)).every(check=>check.done)) fail(403,'수령 조건을 모두 달성해 주세요.');
        id = remaining[roll(remaining.length)];
      }
      await run('INSERT INTO legendary_owned VALUES(?,?,?)',user.id,id,Date.now());
      await run('INSERT INTO legendary_claims VALUES(?,?,?)',user.id,key,id);
      return {pokemon:catalog.get(id)};
    });
  }
  async function equip(u, id) {
    return db.transaction(async()=>{
      const user = await account(u);
      const pokemon = catalog.get(id);
      if (!pokemon||!await get('SELECT 1 FROM legendary_owned WHERE user_id=? AND species=?',user.id,id)) fail(403,'획득한 포켓몬만 선택할 수 있어요.');
      const pet = JSON.parse(user.pet);
      if (pet.diglettRecovery) fail(403,'디그다를 먼저 복구해 주세요.');
      if (pet.character===id) return {ok:true};
      await hydrateCollection(db,user,pet);
      const now = Date.now();
      const enhancement = ensureEnhancement(pet,Math.floor(pet.xp/100)+1,now);
      for (const offer of [enhancement.pending,...enhancement.queued].filter(Boolean)) {
        enhancement.history.push({...offer,character:pet.character,decision:'character-change',success:null,at:now});
      }
      Object.assign(enhancement,{stage:1,pending:null,queued:[],diglettForm:null,lastResult:null});
      Object.assign(pet,{character:id,legendaryPartner:pokemon});
      await run('UPDATE users SET pet=?,partner_locked=1 WHERE id=?',JSON.stringify(pet),user.id);
      return {ok:true};
    });
  }
  async function art(u, key, variant) {
    const id = 'legendary-'+key;
    if (!catalog.has(id)||!await get('SELECT 1 FROM legendary_owned WHERE user_id=? AND species=?',u.id,id)) fail(404,'이미지를 찾을 수 없어요.');
    return new URL('./legendary-art/'+key+'-'+variant+'.png',import.meta.url);
  }
  return {read,claim,equip,art};
}
