import {existsSync} from 'node:fs'
if(existsSync('.env'))process.loadEnvFile('.env')
import {resolve} from 'node:path'
import {createService} from './service.mjs'
import {createHttp} from './http.mjs'
const service=createService(process.env.SPOKEMON_DB??resolve('server/data/spokemon.sqlite'))
const adminExists=service.db.prepare("SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL LIMIT 1").get()
if(!adminExists&&process.env.SPOKEMON_ADMIN_PASSWORD){const password=process.env.SPOKEMON_ADMIN_PASSWORD;if(password.length<12)throw new Error('SPOKEMON_ADMIN_PASSWORD must contain at least 12 characters');service.createUser({login:process.env.SPOKEMON_ADMIN_LOGIN||'admin',nickname:'관리자',password,role:'admin'});console.log('Initial admin account created from environment configuration.')}
if(!adminExists&&!process.env.SPOKEMON_ADMIN_PASSWORD&&process.env.RENDER==='true')throw new Error('Set SPOKEMON_ADMIN_PASSWORD to initialize the admin account')
const options={secure:process.env.COOKIE_SECURE==='true'||process.env.RENDER==='true'}
const origin=process.env.APP_ORIGIN||process.env.RENDER_EXTERNAL_URL;if(origin)options.origins=[origin.replace(/\/$/,'')]
const server=createHttp(service,options),port=Number(process.env.PORT??process.env.API_PORT??3199)
server.listen(port,process.env.API_HOST??(process.env.PORT?'0.0.0.0':'127.0.0.1'),()=>console.log(`Spokemon server: http://127.0.0.1:${port}`))
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{service.close();process.exit(0)}))
