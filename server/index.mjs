import { existsSync } from 'node:fs';
import { createService } from './service.mjs';
import { createHttp } from './http.mjs';
if (existsSync('.env')) process.loadEnvFile('.env');
let service, server;
try {
  service = await createService();
  await service.db.transaction(async () => {
    const admin = await service.db.prepare("SELECT id FROM users WHERE role='admin' AND deleted_at IS NULL LIMIT 1").get();
    if (admin) return;
    const password = process.env.SPOKEMON_ADMIN_PASSWORD;
    if (!password) {
      if (process.env.RENDER === 'true') throw Error('Set SPOKEMON_ADMIN_PASSWORD to initialize the admin account');
      return;
    }
    if (password.length < 12) throw Error('SPOKEMON_ADMIN_PASSWORD must contain at least 12 characters');
    await service.createUser({
      login: process.env.SPOKEMON_ADMIN_LOGIN || 'admin',
      nickname: '관리자',
      password,
      role: 'admin'
    });
    console.log('Initial admin account created from environment configuration.');
  });
  const options = {
      secure: process.env.COOKIE_SECURE === 'true' || process.env.RENDER === 'true'
    },
    origin = process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL;
  if (origin) options.origins = [origin.replace(/\/$/, '')];
  server = await createHttp(service, options);
  const port = Number(process.env.PORT ?? process.env.API_PORT ?? 3199);
  server.listen(port, process.env.API_HOST ?? (process.env.PORT ? '0.0.0.0' : '127.0.0.1'), () => console.log('Spokemon server listening on port ' + port));
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => server.close(async () => {
    await service.close();
    process.exit(0);
  }));
} catch (error) {
  // Driver errors can contain connection information. Never print URLs or tokens.
  console.error('Spokemon startup failed. Check server database/admin environment configuration.', error.code ? 'Code: ' + String(error.code).replace(/[^A-Z0-9_]/gi, '') : '');
  await service?.close();
  process.exitCode = 1;
}
