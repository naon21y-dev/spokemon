import {createGameItems} from './game-items.mjs';
import {createLegendary} from './legendary.mjs';
import {createCollection} from './collection.mjs';
import {createDetective} from './detective/service.mjs';
import {createDungeon} from './dungeon/service.mjs';
import {createFiles} from './files.mjs';
import {createSloud} from './sloud.mjs';
import {createDailyGift} from './daily-gift.mjs';
import {createRoom} from './room.mjs';
import {createGameRankings} from './game-rankings.mjs';
import {createHiddenGame} from './hidden-game.mjs';
import {createCardGame} from './card-game.mjs';
import {createActivity} from './activity.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fail } from './service.mjs';
import {createTimeline} from './timeline.mjs';
import { createPresence } from './presence.mjs';
import { createSocialMailbox as createSocial, createPrivateMailbox as createMail } from './mailbox.mjs';
import { createNotes } from './notes.mjs';
export async function createHttp(service, {
  dist = resolve('dist'),
  origins = ['http://127.0.0.1:5188', 'http://localhost:5188', 'http://localhost:3199', 'http://127.0.0.1:3199'],
  secure = false
} = {}) {
  const attempts = new Map(),
    mail = await createMail(service),
    social = await createSocial(service),
    timeline = createTimeline(service),
    presence = await createPresence(service),
    notes = await createNotes(service),
    activity = await createActivity(service),
    items=await createGameItems(service),collection=await createCollection(service),
    cards = await createCardGame(service,{items}),
    hidden = await createHiddenGame(service,{items}),
    rankings = await createGameRankings(service),
    room = await createRoom(service),
    dungeon=await createDungeon(service,{items}),detective=await createDetective(service),legendary=await createLegendary(service),
    files=await createFiles(service,{mail,social}),sloud=await createSloud(service,files),gifts=await createDailyGift(service);
  return createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff'
      });
      res.end(JSON.stringify(value));
    };
    try {
      const url = new URL(req.url, 'http://localhost'),
        p = url.pathname,
        method = req.method;
      if (!p.startsWith('/api/')) {
        if (method !== 'GET') return await send(404, {
          error: '찾을 수 없어요.'
        });
        const requested = resolve(dist, '.' + decodeURIComponent(p));
        if (!requested.startsWith(dist + sep) && requested !== dist) fail(403, '접근할 수 없어요.');
        let file = requested;
        try {
          if (!(await stat(file)).isFile()) file = resolve(dist, 'index.html');
        } catch {
          file = resolve(dist, 'index.html');
        }
        const bytes = await readFile(file);
        const types = {
          '.html': 'text/html; charset=utf-8',
          '.js': 'text/javascript',
          '.css': 'text/css',
          '.png': 'image/png',
          '.svg': 'image/svg+xml',
          '.woff2': 'font/woff2'
        };
        res.writeHead(200, {
          'Content-Type': types[extname(file)] ?? 'application/octet-stream',
          'X-Content-Type-Options': 'nosniff'
        });
        res.end(bytes);
        return;
      }
      if (method !== 'GET') {
        if (req.headers['x-spokemon-request'] !== '1') fail(403, '요청 출처를 확인할 수 없어요.');
        if (req.headers.origin && !origins.includes(req.headers.origin)) fail(403, '허용되지 않은 출처예요.');
      }
      let body = {};
      if (method !== 'GET') {
        let raw = '',
          size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 2000000) fail(413, '요청이 너무 커요.');
          raw += chunk;
        }
        try {
          body = raw ? JSON.parse(raw) : {};
        } catch {
          fail(400, 'JSON 요청을 확인해 주세요.');
        }
      }
      const token = req.headers.cookie?.match(/(?:^|;\s*)spokemon_session=([^;]+)/)?.[1],
        u = await service.authenticate(token);
      const setCookie = t => res.setHeader('Set-Cookie', `spokemon_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${t ? 604800 : 0}${secure ? '; Secure' : ''}`);
      if (p === '/api/health' && method === 'GET') return await send(200, {
        ok: true
      });
      if (['/api/auth/register', '/api/auth/login'].includes(p) && method === 'POST') {
        const key = req.socket.remoteAddress,
          now = Date.now(),
          rate = await attempts.get(key);
        if (rate && rate.until > now && rate.count >= 30) fail(429, '잠시 후 다시 시도해 주세요.');
        attempts.set(key, {
          until: rate?.until > now ? rate.until : now + 900000,
          count: rate?.until > now ? rate.count + 1 : 1
        });
        let result;
        if (p.endsWith('register')) {
          if (body.role && body.role !== 'student') fail(403, '학생 회원가입으로 관리자 권한을 받을 수 없어요.');
          result = await service.newSession(await service.createUser({
            login: body.login,
            password: body.password,
            nickname: body.nickname,
            role: 'student',
            classId: 'unassigned'
          }));
        } else result = await service.login(body.login, body.password);
        setCookie(result.token);
        return await send(200, {...await service.state(await service.authenticate(result.token)),partnerWaiting:result.partnerWaiting === true});
      }
      if (p === '/api/online' && method === 'GET') return await send(200, await presence.list());
      if (!u) fail(401, '로그인이 필요해요.');
      if (p.startsWith('/api/admin/')) service.admin(u);
      let match;
      if (p === '/api/seeding/study' && method === 'GET') return send(200, await service.seeding.study(u));
      if(p==='/api/seeding/settings'&&method==='GET')return send(200,await service.seeding.settings(u));
      if(p==='/api/admin/seeding'&&method==='PUT')return send(200,await service.seeding.settings(u,body));
      if(p==='/api/seeding'&&method==='GET')return send(200,await service.seeding.read(u,Object.fromEntries(url.searchParams)));
      if(p==='/api/seeding/start'&&method==='POST')return send(200,await service.seeding.start(u,body));
      if((match=p.match(/^\/api\/seeding\/([^/]+)\/(draft|submit)$/))&&method==='POST')return send(200,await service.seeding[match[2]](u,match[1],body));
      if(p==='/api/legendary'&&method==='GET')return send(200,await legendary.read(u));
      if(p==='/api/legendary/claim'&&method==='POST')return send(200,await legendary.claim(u,body));
      if(p==='/api/legendary/equip'&&method==='POST')return send(200,await legendary.equip(u,body.id));
      if(method==='GET'&&(match=p.match(/^\/api\/legendary\/art\/([a-z-]+)\/(base|shiny)$/))){
        const bytes=await readFile(await legendary.art(u,match[1],match[2]));
        res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});
        return res.end(bytes);
      }
      if(p==='/api/collection'&&method==='GET')return send(200,await collection.read(u));
      if(p==='/api/collection'&&method==='POST')return send(200,await collection.act(u,body));
      if(p==='/api/game-items'&&method==='GET')return send(200,await items.inventory(u));
      if(p==='/api/game-items/buy'&&method==='POST')return send(200,await items.buy(u,body));
      if(p==='/api/game-items/use'&&method==='POST'){const game=body.item?.split('-')[0];if(game==='cards')return send(200,await cards.memory(u,body.sessionId,body));if(game==='hidden')return send(200,await hidden.reveal(u,body.sessionId,body));if(game==='dungeon')return send(200,await dungeon.item(u,body.sessionId,body));fail(400,'아이템을 확인해 주세요.');}

      if(p==='/api/files'&&method==='POST')return send(200,await files.upload(u,body));
      if((match=p.match(/^\/api\/attachments\/(private|friend|sloud)\/([^/]+)$/))&&method==='GET')return send(200,await files.list(u,match[1],match[2]));
      if((match=p.match(/^\/api\/files\/([^/]+)$/))&&method==='GET'){const f=await files.read(u,match[1]);res.writeHead(200,{'Content-Type':f.mime,'Content-Length':f.size,'Content-Disposition':(f.mime.startsWith('image/')?'inline':'attachment')+"; filename*=UTF-8''"+encodeURIComponent(f.name),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox",'Cache-Control':'private, no-store'});return res.end(Buffer.from(f.data));}
      if(p==='/api/gift'&&method==='GET')return send(200,await gifts.read(u));
      if(p==='/api/gift/pick'&&method==='POST')return send(200,await gifts.pick(u,body));
      if(p==='/api/gift/claim'&&method==='POST')return send(200,await gifts.claim(u,body));
      if(p==='/api/sloud'&&method==='GET')return send(200,await sloud.list(u,Object.fromEntries(url.searchParams)));
      if(p==='/api/sloud'&&method==='POST')return send(200,await sloud.save(u,body));
      if((match=p.match(/^\/api\/sloud\/([^/]+)(?:\/(comments)(?:\/([^/]+))?)?$/))){const [,id,action,cid]=match;if(method==='GET'&&!action)return send(200,await sloud.detail(u,id));if(method==='POST'&&action==='comments'&&!cid)return send(200,await sloud.comment(u,id,body));if(method==='DELETE')return send(200,await sloud.remove(u,id,cid));}
      if(p==='/api/admin/online'&&method==='GET')return send(200,await presence.list(u));
      if(p==='/api/room'&&method==='GET')return send(200,await room.read(u));
      if(p==='/api/room'&&method==='PUT')return send(200,await room.save(u,body));
      if(p==='/api/room/buy'&&method==='POST')return send(200,await room.buy(u,body));
      if(p==='/api/attendance'&&method==='POST')return send(200,await service.attendance.checkIn(u));
      if(p==='/api/quests'&&method==='GET')return send(200,await service.quests.list(u));
      if(p==='/api/quests/claim-all'&&method==='POST')return send(200,await service.quests.claimAll(u));
      if(p==='/api/quests/claim'&&method==='POST')return send(200,await service.quests.claim(u,body.questId));
      if(p==='/api/timeline'&&method==='GET')return send(200,await timeline.list(u,url.searchParams.get('offset')));
      if(p==='/api/timeline/read'&&method==='POST')return send(200,await timeline.readAll(u));
      if(p==='/api/activity/notifications'&&method==='GET')return send(200,await activity.list(u));
      if(p==='/api/activity/notifications/read'&&method==='POST')return send(200,await activity.acknowledge(u,body));
      if(p==='/api/cards/start'&&method==='POST')return send(200,await cards.start(u,body));
      if(p==='/api/admin/game-rankings'&&method==='GET')return send(200,await rankings.adminList(u,Object.fromEntries(url.searchParams)));
      if(p==='/api/admin/game-rankings'&&method==='DELETE')return send(200,await rankings.adminClear(u,body));
      const rankingMatch=p.match(/^\/api\/admin\/game-rankings\/(cards|hidden)\/([-\w]+)(?:\/(restore))?$/);if(rankingMatch){if(method==='DELETE'&&!rankingMatch[3])return send(200,await rankings.adminRemove(u,rankingMatch[1],rankingMatch[2]));if(method==='POST'&&rankingMatch[3])return send(200,await rankings.adminRemove(u,rankingMatch[1],rankingMatch[2],true));}
      if(p==='/api/game-rankings'&&method==='GET')return send(200,await rankings.list(u,url.searchParams.get('game'),Number(url.searchParams.get('level'))));
      if(p==='/api/hidden/start'&&method==='POST')return send(200,await hidden.start(u,body));
      const hiddenMatch=p.match(/^\/api\/hidden\/([^/]+)\/action$/);
      if(hiddenMatch&&method==='POST')return send(200,await hidden.act(u,hiddenMatch[1],body));
      const cardMatch=p.match(/^\/api\/cards\/([^/]+)\/flip$/);
      if(cardMatch&&method==='POST')return send(200,await cards.flip(u,cardMatch[1],body));
      if (p === '/api/curriculum' && method === 'GET') return send(200, await service.curriculum());
      if(p==='/api/admin/curriculum'&&method==='GET')return send(200,await service.archivedCurriculum(u));
      if(p==='/api/admin/curriculum'&&method==='PATCH')return send(200,await service.manageCurriculum(u,body));
      if (p === '/api/admin/curriculum' && method === 'POST') return send(200, await service.addCurriculum(u, body));
      if (p === '/api/admin/message-recipients' && method === 'GET') return send(200, await mail.recipients(u, url.searchParams.get('search') ?? ''));
      if (p === '/api/admin/messages' && method === 'POST') return send(200, await files.withFiles(u,'private',body,()=>mail.sendAdmin(u,body)));
      if (p === '/api/notes' && method === 'GET') return await send(200, await notes.read(u, (await url.searchParams.get('date')) ?? undefined));
      if ((match = p.match(/^\/api\/notes\/(\d{4}-\d{2}-\d{2})$/)) && method === 'PUT') return await send(200, await notes.save(u, match[1], body));
      if (p === '/api/workshop' && method === 'GET') return await send(200, await service.workshop.list(u, Object.fromEntries(url.searchParams)));
      if (p === '/api/workshop' && method === 'POST') return await send(200, await service.workshop.save(u, body));
      if (p === '/api/workshop/batch' && method === 'POST') return await send(200, await service.workshop.saveBatch(u, body));
      if (p === '/api/reward-settings' && method === 'GET') return await send(200, await service.workshop.settings());
      if (p === '/api/learning-stats' && method === 'GET') return await send(200, await service.workshop.analytics(u, (await url.searchParams.get('source')) ?? 'all', (await url.searchParams.get('studentId')) ?? undefined, Object.fromEntries(url.searchParams)));
      if (p === '/api/admin/reward-settings' && method === 'PUT') return await send(200, await service.workshop.settings(u, body));
      if (match = p.match(/^\/api\/workshop\/([^/]+)(?:\/(edit|start|moderate))?$/)) {
        const [, id, action] = match;
        if (method === 'GET' && (!action || action === 'edit')) return await send(200, await service.workshop.detail(u, id, action === 'edit'));
        if (method === 'POST' && action === 'start') return await send(200, await service.workshop.start(u, id));
        if (method === 'PUT' && !action) return await send(200, await service.workshop.save(u, body, id));
        if (method === 'POST' && action === 'moderate') return await send(200, await service.workshop.moderate(u, id, body.published === true));
      }
      if (p === '/api/presence' && method === 'POST') return await send(200, await presence.touch(u, body.active === true));
      if (p === '/api/auth/logout' && method === 'POST') {
        await service.logout(token);
        setCookie('');
        return await send(200, {
          ok: true
        });
      }
      if (p === '/api/friends/search' && method === 'GET') return await send(200, await social.search(u, await url.searchParams.get('login')));
      if (p === '/api/friends' && method === 'GET') return await send(200, await social.list(u));
      if (p === '/api/friends' && method === 'POST') return await send(200, await social.add(u, body.studentId));
      if(p==='/api/friend-messages'&&method==='DELETE')return send(200,await social.clear(u,body));
      if (p === '/api/friend-messages' && method === 'POST') return await send(200, await files.withFiles(u,'friend',body,()=>social.send(u,body)));
      if (match = p.match(/^\/api\/friend-messages\/([^/]+)(?:\/(read))?$/)) {
        if (method === 'DELETE' && !match[2]) return send(200, await social.remove(u, match[1]));
        if (method === 'GET' && !match[2]) return await send(200, await social.detail(u, match[1]));
        if (method === 'POST' && match[2] === 'read') return await send(200, await social.detail(u, match[1], true));
      }
      if (p === '/api/messages/summary' && method === 'GET') {
        const result = await mail.summary(u);
        result.events=await mail.notifications(u);
        if (u.role === 'student'){result.unread += await social.summary(u);result.events.push(...await social.notifications(u));}
        result.events.sort((a,b)=>b.at-a.at);
        return await send(200, result);
      }
      if(p==='/api/messages'&&method==='DELETE')return send(200,await mail.clear(u,body));
      if(p==='/api/admin/messages'&&method==='DELETE')return send(200,await mail.clear(u,body,true));
      if (p === '/api/messages' && method === 'GET') return await send(200, await mail.list(u));
      if (p === '/api/messages' && method === 'POST') return await send(200, await files.withFiles(u,'private',body,()=>mail.send(u,body)));
      if (match = p.match(/^\/api\/messages\/([^/]+)(?:\/(read|reply))?$/)) {
        if (method === 'DELETE' && !match[2]) return send(200, await mail.remove(u, match[1]));
        if (method === 'POST' && match[2] === 'reply') return send(200, await files.withFiles(u,'private',body,()=>mail.studentReply(u,match[1],body),match[1]));
        if (method === 'GET' && !match[2]) return await send(200, await mail.detail(u, match[1]));
        if (method === 'POST' && match[2] === 'read') return await send(200, await mail.read(u, match[1], body));
      }
      if (p === '/api/admin/messages' && method === 'GET') return await send(200, await mail.list(u, Object.fromEntries(url.searchParams), true));
      if (match = p.match(/^\/api\/admin\/messages\/([^/]+)(?:\/(reply))?$/)) {
        if (method === 'DELETE' && !match[2]) return send(200, await mail.remove(u, match[1], true));
        if (method === 'GET' && !match[2]) return await send(200, await mail.detail(u, match[1], true));
        if (method === 'POST' && match[2] === 'reply') return await send(200, await files.withFiles(u,'private',body,()=>mail.reply(u,match[1],body),match[1]));
      }
      if(p==='/api/auth/password'&&method==='POST'){
        const key='password:'+u.id,now=Date.now(),rate=attempts.get(key);if(rate&&rate.until>now&&rate.count>=10)fail(429,'잠시 후 다시 시도해 주세요.');attempts.set(key,{until:rate?.until>now?rate.until:now+900000,count:rate?.until>now?rate.count+1:1});
        const result=await service.changePassword(u,body);setCookie('');return send(200,result);
      }
      if((match=p.match(/^\/api\/admin\/students\/([^/]+)\/password-reset$/))&&method==='POST')return send(200,await service.resetStudentPassword(u,match[1],body));
      if(p==='/api/detective/reset'&&method==='POST')return send(200,await detective.reset(u));
      if(p==='/api/detective/start'&&method==='POST')return send(200,await detective.start(u,body));
      if(p==='/api/detective/history'&&method==='GET')return send(200,await detective.history(u));
      if((match=p.match(/^\/api\/detective\/([^/]+)(?:\/(enter|answer|accuse|end|pause|hint))?$/))){const [,id,action]=match;if(method==='GET'&&!action)return send(200,await detective.view(u,id));if(method==='POST'&&['enter','answer','accuse','end','pause','hint'].includes(action))return send(200,await detective[action](u,id,body));}
      if(p==='/api/dungeon/reset'&&method==='POST')return send(200,await dungeon.reset(u));
      if(p==='/api/dungeon/start'&&method==='POST')return send(200,await dungeon.start(u,body));
      if(p==='/api/dungeon/history'&&method==='GET')return send(200,await dungeon.history(u));
      if((match=p.match(/^\/api\/dungeon\/([^/]+)(?:\/(enter|answer|end|pause))?$/))){const [,id,action]=match;if(method==='GET'&&!action)return send(200,await dungeon.view(u,id));if(method==='POST'&&['enter','answer','end','pause'].includes(action))return send(200,await dungeon[action](u,id,body));}
      if(p==='/api/tickets'&&method==='GET')return send(200,await service.tickets.list(u));
      if((match=p.match(/^\/api\/tickets\/([^/]+)\/claim$/))&&method==='POST')return send(200,await service.tickets.claim(u,match[1]));
      if((match=p.match(/^\/api\/admin\/students\/([^/]+)\/gifts$/))){if(method==='GET')return send(200,await service.tickets.read(u,match[1]));if(method==='POST')return send(200,await service.tickets.send(u,match[1],body));}
      if (p === '/api/me' && method === 'GET') return await send(200, await service.state(u));
      if (p === '/api/profile' && method === 'PATCH') return await send(200, await service.updateProfile(u, body));
      if (p === '/api/pet' && method === 'POST') return await send(200, await service.petAction(u, body));
      if (p === '/api/games' && method === 'PUT') {
        await service.saveGame(u, body);
        return await send(200, {
          ok: true
        });
      }
      if (p === '/api/migration' && method === 'POST') return await send(200, await service.migration(u, body));
      if (p === '/api/catalog' && method === 'GET') return await send(200, await service.catalog(u));
      if (p === '/api/summary' && method === 'GET') {
        service.student(u);
        return await send(200, await service.summary(u));
      }
      if (p === '/api/learning' && method === 'GET') return await send(200, await service.learningState(u));
      if (p === '/api/quiz/start' && method === 'POST') return await send(200, await service.startQuiz(u, body));
      if (p === '/api/review/start' && method === 'POST') return await send(200, await service.startReview(u, body));
      if (match = p.match(/^\/api\/quiz\/([^/]+)(?:\/(submit|next|draft))?$/)) {
        const [, id, action] = match;
        if (method === 'GET' && !action) return await send(200, await service.quizView(await service.getQuiz(u, id)));
        if (method === 'POST' && action === 'submit') return await send(200, await service.submit(u, id, body));
        if (method === 'POST' && action === 'next') return await send(200, await service.next(u, id));
        if (method === 'PUT' && action === 'draft') {
          await service.draft(u, id, body.draft);
          return await send(200, {
            ok: true
          });
        }
      }
      if ((match = p.match(/^\/api\/lesson\/([^/]+)\/(\d+)$/)) && method === 'GET') return await send(200, await service.lesson(u, match[1], Number(match[2])));
      if ((match = p.match(/^\/api\/complete\/([^/]+)$/)) && method === 'POST') {
        await service.complete(u, match[1]);
        return await send(200, {
          ok: true
        });
      }
      if ((match = p.match(/^\/api\/lesson\/([^/]+)\/(\d+)\/complete$/)) && method === 'POST') return send(200,await service.completeLesson(u,match[1],Number(match[2]),body));
      if (p === '/api/study/heartbeat' && method === 'POST') return await send(200, await service.heartbeat(u, body));
      if (p === '/api/admin/dashboard' && method === 'GET') return await send(200, await service.adminData(u, Object.fromEntries(url.searchParams)));
      if (p === '/api/admin/classes' && method === 'POST') return await send(200, await service.createClass(u, body.name));
      if (p === '/api/admin/releases' && method === 'PUT') {
        await service.release(u, body);
        return await send(200, {
          ok: true
        });
      }
      if (match = p.match(/^\/api\/admin\/students\/([^/]+)(?:\/(class|migration|points|private-name))?$/)) {
        const [, id, action] = match;
        if(method==='PUT'&&action==='private-name')return send(200,await service.saveStudentPrivateName(u,id,body));
        if(method==='GET'&&action==='points')return send(200,await service.points.read(u,id));
        if(method==='POST'&&action==='points')return send(200,await service.points.grant(u,id,body));
        if (method === 'DELETE' && !action) return await send(200, await service.deleteStudent(u, id, body));
        if (method === 'GET' && !action) return await send(200, await service.studentDetail(u, id));
        if (method === 'PUT' && action === 'class') {
          await service.assignClass(u, id, body.classId);
          return await send(200, {
            ok: true
          });
        }
        if (method === 'POST' && action === 'migration') {
          await service.approveMigration(u, id);
          return await send(200, {
            ok: true
          });
        }
      }
      await send(404, {
        error: '요청한 API가 없어요.'
      });
    } catch (e) {
      if (!e.status) console.error('API database/request failure', String(e.code ?? 'INTERNAL_ERROR').replace(/[^A-Z0-9_]/gi, ''));
      await send(e.status ?? 500, {
        error: e.status ? e.message : '서버 처리 중 문제가 생겼어요.'
      });
    }
  });
}
