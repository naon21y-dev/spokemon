import {createServer} from 'node:http'
import {readFile,stat} from 'node:fs/promises'
import {resolve,extname,sep} from 'node:path'
import {fail} from './service.mjs'
import {createPresence} from './presence.mjs'
import {createSocial} from './social.mjs'
import {createNotes} from './notes.mjs'
import {createMail} from './mail.mjs'
export function createHttp(service,{dist=resolve('dist'),origins=['http://127.0.0.1:5188','http://localhost:5188','http://localhost:3199','http://127.0.0.1:3199'],secure=false}={}){
 const attempts=new Map(),mail=createMail(service),social=createSocial(service),presence=createPresence(service),notes=createNotes(service)
 return createServer(async(req,res)=>{
  const send=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(value))}
  try{
   const url=new URL(req.url,'http://localhost'),p=url.pathname,method=req.method
   if(!p.startsWith('/api/')){if(method!=='GET')return send(404,{error:'찾을 수 없어요.'});const requested=resolve(dist,'.'+decodeURIComponent(p));if(!requested.startsWith(dist+sep)&&requested!==dist)fail(403,'접근할 수 없어요.');let file=requested;try{if(!(await stat(file)).isFile())file=resolve(dist,'index.html')}catch{file=resolve(dist,'index.html')}const bytes=await readFile(file);const types={'.html':'text/html; charset=utf-8','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'};res.writeHead(200,{'Content-Type':types[extname(file)]??'application/octet-stream','X-Content-Type-Options':'nosniff'});res.end(bytes);return}
   if(method!=='GET'){if(req.headers['x-spokemon-request']!=='1')fail(403,'요청 출처를 확인할 수 없어요.');if(req.headers.origin&&!origins.includes(req.headers.origin))fail(403,'허용되지 않은 출처예요.')}
   let body={};if(method!=='GET'){let raw='',size=0;for await(const chunk of req){size+=chunk.length;if(size>2000000)fail(413,'요청이 너무 커요.');raw+=chunk}try{body=raw?JSON.parse(raw):{}}catch{fail(400,'JSON 요청을 확인해 주세요.')}}
   const token=req.headers.cookie?.match(/(?:^|;\s*)spokemon_session=([^;]+)/)?.[1],u=service.authenticate(token)
   const setCookie=t=>res.setHeader('Set-Cookie',`spokemon_session=${t}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${t?604800:0}${secure?'; Secure':''}`)
   if(p==='/api/health'&&method==='GET')return send(200,{ok:true})
   if(['/api/auth/register','/api/auth/login'].includes(p)&&method==='POST'){
    const key=req.socket.remoteAddress,now=Date.now(),rate=attempts.get(key);if(rate&&rate.until>now&&rate.count>=30)fail(429,'잠시 후 다시 시도해 주세요.');attempts.set(key,{until:rate?.until>now?rate.until:now+900000,count:rate?.until>now?rate.count+1:1})
    let result;if(p.endsWith('register')){if(body.role&&body.role!=='student')fail(403,'학생 회원가입으로 관리자 권한을 받을 수 없어요.');result=service.newSession(service.createUser({login:body.login,password:body.password,nickname:body.nickname,role:'student',classId:'unassigned'}))}else result=service.login(body.login,body.password)
    setCookie(result.token);return send(200,service.state(service.authenticate(result.token)))
   }
   if(p==='/api/online'&&method==='GET')return send(200,presence.list())
   if(!u)fail(401,'로그인이 필요해요.')
   if(p.startsWith('/api/admin/'))service.admin(u)
   let match
   if(p==='/api/notes'&&method==='GET')return send(200,notes.read(u,url.searchParams.get('date')??undefined))
   if((match=p.match(/^\/api\/notes\/(\d{4}-\d{2}-\d{2})$/))&&method==='PUT')return send(200,notes.save(u,match[1],body))
   if(p==='/api/workshop'&&method==='GET')return send(200,service.workshop.list(u,Object.fromEntries(url.searchParams)))
   if(p==='/api/workshop'&&method==='POST')return send(200,service.workshop.save(u,body))
   if(p==='/api/workshop/batch'&&method==='POST')return send(200,service.workshop.saveBatch(u,body))
   if(p==='/api/reward-settings'&&method==='GET')return send(200,service.workshop.settings())
   if(p==='/api/learning-stats'&&method==='GET')return send(200,service.workshop.analytics(u,url.searchParams.get('source')??'all',url.searchParams.get('studentId')??undefined,Object.fromEntries(url.searchParams)))
   if(p==='/api/admin/reward-settings'&&method==='PUT')return send(200,service.workshop.settings(u,body))
   if((match=p.match(/^\/api\/workshop\/([^/]+)(?:\/(edit|start|moderate))?$/))){const [,id,action]=match;if(method==='GET'&&(!action||action==='edit'))return send(200,service.workshop.detail(u,id,action==='edit'));if(method==='POST'&&action==='start')return send(200,service.workshop.start(u,id));if(method==='PUT'&&!action)return send(200,service.workshop.save(u,body,id));if(method==='POST'&&action==='moderate')return send(200,service.workshop.moderate(u,id,body.published===true))}
   if(p==='/api/presence'&&method==='POST')return send(200,presence.touch(u,body.active===true))
   if(p==='/api/auth/logout'&&method==='POST'){service.logout(token);setCookie('');return send(200,{ok:true})}
   if(p==='/api/friends/search'&&method==='GET')return send(200,social.search(u,url.searchParams.get('login')))
   if(p==='/api/friends'&&method==='GET')return send(200,social.list(u))
   if(p==='/api/friends'&&method==='POST')return send(200,social.add(u,body.studentId))
   if(p==='/api/friend-messages'&&method==='POST')return send(200,social.send(u,body))
   if((match=p.match(/^\/api\/friend-messages\/([^/]+)(?:\/(read))?$/))){if(method==='GET'&&!match[2])return send(200,social.detail(u,match[1]));if(method==='POST'&&match[2]==='read')return send(200,social.detail(u,match[1],true))}
   if(p==='/api/messages/summary'&&method==='GET'){const result=mail.summary(u);if(u.role==='student')result.unread+=social.summary(u);return send(200,result)}
   if(p==='/api/messages'&&method==='GET')return send(200,mail.list(u))
   if(p==='/api/messages'&&method==='POST')return send(200,mail.send(u,body))
   if((match=p.match(/^\/api\/messages\/([^/]+)(?:\/(read))?$/))){if(method==='GET'&&!match[2])return send(200,mail.detail(u,match[1]));if(method==='POST'&&match[2]==='read')return send(200,mail.read(u,match[1],body))}
   if(p==='/api/admin/messages'&&method==='GET')return send(200,mail.list(u,Object.fromEntries(url.searchParams),true))
   if((match=p.match(/^\/api\/admin\/messages\/([^/]+)(?:\/(reply))?$/))){if(method==='GET'&&!match[2])return send(200,mail.detail(u,match[1],true));if(method==='POST'&&match[2]==='reply')return send(200,mail.reply(u,match[1],body))}
   if(p==='/api/me'&&method==='GET')return send(200,service.state(u))
   if(p==='/api/profile'&&method==='PATCH')return send(200,service.updateProfile(u,body))
   if(p==='/api/pet'&&method==='POST')return send(200,service.petAction(u,body))
   if(p==='/api/games'&&method==='PUT'){service.saveGame(u,body);return send(200,{ok:true})}
   if(p==='/api/migration'&&method==='POST')return send(200,service.migration(u,body))
   if(p==='/api/catalog'&&method==='GET')return send(200,service.catalog(u))
   if(p==='/api/summary'&&method==='GET'){service.student(u);return send(200,service.summary(u))}
   if(p==='/api/learning'&&method==='GET')return send(200,service.learningState(u))
   if(p==='/api/quiz/start'&&method==='POST')return send(200,service.startQuiz(u,body))
   if(p==='/api/review/start'&&method==='POST')return send(200,service.startReview(u,body))
   if((match=p.match(/^\/api\/quiz\/([^/]+)(?:\/(submit|next|draft))?$/))){const [,id,action]=match;if(method==='GET'&&!action)return send(200,service.quizView(service.getQuiz(u,id)));if(method==='POST'&&action==='submit')return send(200,service.submit(u,id,body));if(method==='POST'&&action==='next')return send(200,service.next(u,id));if(method==='PUT'&&action==='draft'){service.draft(u,id,body.draft);return send(200,{ok:true})}}
   if((match=p.match(/^\/api\/lesson\/([^/]+)\/(\d+)$/))&&method==='GET')return send(200,service.lesson(u,match[1],Number(match[2])))
   if((match=p.match(/^\/api\/complete\/([^/]+)$/))&&method==='POST'){service.complete(u,match[1]);return send(200,{ok:true})}
   if(p==='/api/study/heartbeat'&&method==='POST')return send(200,service.heartbeat(u,body))
   if(p==='/api/admin/dashboard'&&method==='GET')return send(200,service.adminData(u,Object.fromEntries(url.searchParams)))
   if(p==='/api/admin/classes'&&method==='POST')return send(200,service.createClass(u,body.name))
   if(p==='/api/admin/releases'&&method==='PUT'){service.release(u,body);return send(200,{ok:true})}
   if((match=p.match(/^\/api\/admin\/students\/([^/]+)(?:\/(class|migration))?$/))){const [,id,action]=match;if(method==='DELETE'&&!action)return send(200,service.deleteStudent(u,id,body));if(method==='GET'&&!action)return send(200,service.studentDetail(u,id));if(method==='PUT'&&action==='class'){service.assignClass(u,id,body.classId);return send(200,{ok:true})}if(method==='POST'&&action==='migration'){service.approveMigration(u,id);return send(200,{ok:true})}}
   send(404,{error:'요청한 API가 없어요.'})
  }catch(e){if(!e.status)console.error(e);send(e.status??500,{error:e.status?e.message:'서버 처리 중 문제가 생겼어요.'})}
 })
}
