import { existsSync } from 'node:fs';
if (existsSync('.env')) process.loadEnvFile('.env');
import { createService } from './service.mjs';
const args = process.argv.slice(2),
  value = key => args[args.indexOf(key) + 1];
const password = process.env.SPOKEMON_ADMIN_PASSWORD;
if (!password) {
  console.error('SPOKEMON_ADMIN_PASSWORD 환경 변수에 12자 이상의 관리자 비밀번호를 지정해 주세요.');
  process.exit(1);
}
if (password.length < 12) {
  console.error('관리자 비밀번호는 12자 이상이어야 합니다.');
  process.exit(1);
}
let service;
try {
  service = await createService();
  await service.createUser({
    login: args.includes('--login') ? value('--login') : 'teacher',
    nickname: args.includes('--name') ? value('--name') : '관리자',
    password,
    role: 'admin'
  });
  console.log('관리자 계정을 생성했습니다. 비밀번호는 출력하거나 저장 파일에 남기지 않습니다.');
} catch (e) {
  console.error(e.status ? e.message : '관리자 생성 실패: 서버 DB 환경변수와 연결을 확인하세요.');
  process.exitCode = 1;
} finally {
  delete process.env.SPOKEMON_ADMIN_PASSWORD;
  await service?.close();
}
