import { existsSync } from 'node:fs';
import { createClient } from '@libsql/client';
import { databaseConfig } from '../server/database.mjs';
if (existsSync('.env')) process.loadEnvFile('.env');
let client;
try {
  if (!process.env.TURSO_DATABASE_URL || !process.env.TURSO_AUTH_TOKEN) throw Error('Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in the server environment first.');
  client = createClient(databaseConfig());
  const result = await client.execute('SELECT 1 AS connected');
  if (result.rows[0].connected !== 1) throw Error('Unexpected connectivity result');
  console.log('PASS: remote Turso authenticated connection. No schema or data was modified.');
} catch (e) {
  console.error(e.code ? 'Remote check failed: ' + String(e.code).replace(/[^A-Z0-9_]/gi, '') : 'Remote check unavailable. Set the two Turso server environment variables and retry.');
  process.exitCode = 1;
} finally {
  client?.close();
}
