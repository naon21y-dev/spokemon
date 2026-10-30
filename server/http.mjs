import {createGameRankings} from './game-rankings.mjs';
import {createHiddenGame} from './hidden-game.mjs';
import {createCardGame} from './card-game.mjs';
import {createActivity} from './activity.mjs';
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fail } from './service.mjs';
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
    presence = await createPresence(service),
    notes = await createNotes(service),
    activity = await createActivity(service),
    cards = await createCardGame(service),
    hidden = await createHiddenGame(service),
    rankings = await createGameRankings(service);
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
        return await send(200, await service.state(await service.authenticate(result.token)));
      }
      if (p === '/api/online' && method === 'GET') return await send(200, await presence.list());
      if (!u) fail(401, '로그인이 필요해요.');
      if (p.startsWith('/api/admin/')) service.admin(u);
      if(p==='/api/attendance'&&method==='POST')return send(200,await service.attendance.checkIn(u));
      if(p==='/api/quests'&&method==='GET')return send(200,await service.quests.list(u));
      if(p==='/api/quests/claim'&&method==='POST')return send(200,await service.quests.claim(u,body.questId));
      if(p==='/api/activity/notifications'&&method==='GET')return send(200,await activity.list(u));
      if(p==='/api/activity/notifications/read'&&method==='POST')return send(200,await activity.acknowledge(u,body));
      if(p==='/api/cards/start'&&method==='POST')return send(200,await cards.start(u,body));
      if(p==='/api/game-rankings'&&method==='GET')return send(200,await rankings.list(u,url.searchParams.get('game'),Number(url.searchParams.get('level'))));
      if(p==='/api/hidden/start'&&method==='POST')return send(200,await hidden.start(u,body));
      const hiddenMatch=p.match(/^\/api\/hidden\/([^/]+)\/action$/);
      if(hiddenMatch&&method==='POST')return send(200,await hidden.act(u,hiddenMatch[1],body));
      const cardMatch=p.match(/^\/api\/cards\/([^/]+)\/flip$/);
      if(cardMatch&&method==='POST')return send(200,await cards.flip(u,cardMatch[1],body));
      let match;
      if (p === '/api/curriculum' && method === 'GET') return send(200, await service.curriculum());
      if(p==='/api/admin/curriculum'&&method==='GET')return send(200,await service.archivedCurriculum(u));
      if(p==='/api/admin/curriculum'&&method==='PATCH')return send(200,await service.manageCurriculum(u,body));
      if (p === '/api/admin/curriculum' && method === 'POST') return send(200, await service.addCurriculum(u, body));
      if (p === '/api/admin/message-recipients' && method === 'GET') return send(200, await mail.recipients(u, url.searchParams.get('search') ?? ''));
      if (p === '/api/admin/messages' && method === 'POST') return send(200, await mail.sendAdmin(u, body));
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
      if (p === '/api/friend-messages' && method === 'POST') return await send(200, await social.send(u, body));
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
      if (p === '/api/messages' && method === 'POST') return await send(200, await mail.send(u, body));
      if (match = p.match(/^\/api\/messages\/([^/]+)(?:\/(read|reply))?$/)) {
        if (method === 'DELETE' && !match[2]) return send(200, await mail.remove(u, match[1]));
        if (method === 'POST' && match[2] === 'reply') return send(200, await mail.studentReply(u, match[1], body));
        if (method === 'GET' && !match[2]) return await send(200, await mail.detail(u, match[1]));
        if (method === 'POST' && match[2] === 'read') return await send(200, await mail.read(u, match[1], body));
      }
      if (p === '/api/admin/messages' && method === 'GET') return await send(200, await mail.list(u, Object.fromEntries(url.searchParams), true));
      if (match = p.match(/^\/api\/admin\/messages\/([^/]+)(?:\/(reply))?$/)) {
        if (method === 'DELETE' && !match[2]) return send(200, await mail.remove(u, match[1], true));
        if (method === 'GET' && !match[2]) return await send(200, await mail.detail(u, match[1], true));
        if (method === 'POST' && match[2] === 'reply') return await send(200, await mail.reply(u, match[1], body));
      }
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
      if (p === '/api/study/heartbeat' && method === 'POST') return await send(200, await service.heartbeat(u, body));
      if (p === '/api/admin/dashboard' && method === 'GET') return await send(200, await service.adminData(u, Object.fromEntries(url.searchParams)));
      if (p === '/api/admin/classes' && method === 'POST') return await send(200, await service.createClass(u, body.name));
      if (p === '/api/admin/releases' && method === 'PUT') {
        await service.release(u, body);
        return await send(200, {
          ok: true
        });
      }
      if (match = p.match(/^\/api\/admin\/students\/([^/]+)(?:\/(class|migration|points))?$/)) {
        const [, id, action] = match;
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
