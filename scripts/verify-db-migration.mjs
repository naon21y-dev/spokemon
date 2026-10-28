import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createHash } from 'node:crypto';
import { createClient } from '@libsql/client';
import { DatabaseSync } from 'node:sqlite';
import { createService } from '../server/service.mjs';
import { createHttp } from '../server/http.mjs';
import { openDatabase } from '../server/database.mjs';
import { migrateSqlite, readSnapshot } from './migrate-sqlite-to-turso.mjs';
const dir = mkdtempSync(join(tmpdir(), 'spokemon-turso-import-')),
  source = join(dir, 'source.sqlite'),
  targetFile = join(dir, 'target.sqlite'),
  url = pathToFileURL(targetFile).href;
const service = await createService(source);
const u = await service.createUser({
  login: 'import_student',
  nickname: '이전학생',
  password: 'test-only-pass'
});
await service.db.prepare('UPDATE users SET coins=? WHERE id=?').run(987, u.id);
const http = await createHttp(service);
await service.db.prepare('INSERT INTO daily_notes VALUES(?,?,?,?,?,?)').run(u.id, '2026-10-27', '나의 학습', '기록을 그대로 보존', 1, 123);
await service.db.exec("CREATE TABLE migration_blob(id INTEGER PRIMARY KEY,bytes BLOB,label TEXT); INSERT INTO migration_blob VALUES(9007199254740993,X'0001FF','한글'); CREATE TRIGGER preserve_note AFTER UPDATE ON migration_blob BEGIN SELECT 1; END;");
await service.close();
http.close();
const hash = () => createHash('sha256').update(readFileSync(source)).digest('hex'),
  before = hash(),
  target = createClient({
    url,
    intMode: 'bigint'
  });
try {
  const dry = await migrateSqlite({
    source,
    dryRun: true
  });
  assert(dry.dryRun);
  assert(dry.rows >= 702);
  let interrupted = false;
  await assert.rejects(migrateSqlite({
    source,
    target,
    batchSize: 11,
    afterChunk() {
      if (!interrupted) {
        interrupted = true;
        throw Error('simulated disconnect');
      }
    }
  }), /simulated disconnect/);
  await assert.rejects(openDatabase(targetFile), /import is incomplete/);
  const result = await migrateSqlite({
    source,
    target,
    batchSize: 13
  });
  assert(result.complete);
  assert((await migrateSqlite({
    source,
    target
  })).alreadyComplete);
  assert.equal(hash(), before, 'source file must remain unchanged');
  assert.equal((await target.execute({
    sql: 'SELECT coins FROM users WHERE id=?',
    args: [u.id]
  })).rows[0].coins, 987n);
  assert.equal((await target.execute('SELECT body FROM daily_notes')).rows[0].body, '기록을 그대로 보존');
  const blob = (await target.execute('SELECT * FROM migration_blob')).rows[0];
  assert.equal(blob.id, 9007199254740993n);
  assert.deepEqual(Buffer.from(blob.bytes), Buffer.from([0, 1, 255]));
  assert.equal((await target.execute("SELECT name FROM sqlite_master WHERE type='trigger' AND name='preserve_note'")).rows.length, 1);
  const reopened = await openDatabase(targetFile);
  await reopened.close();
  const dirty = createClient({
    url: pathToFileURL(join(dir, 'dirty.sqlite')).href,
    intMode: 'bigint'
  });
  await dirty.execute('CREATE TABLE existing(value TEXT)');
  await assert.rejects(migrateSqlite({
    source,
    target: dirty
  }), /empty database/);
  dirty.close();
  const changed = new DatabaseSync(source);
  changed.prepare('UPDATE users SET name=? WHERE id=?').run('바뀐 원본', u.id);
  changed.close();
  await assert.rejects(migrateSqlite({
    source,
    target
  }), /Source changed/);
  assert(readSnapshot(source).tables.length > 25);
  console.log('PASS: full-schema read-only SQLite migration, dry-run, interruption/resume, incomplete startup refusal, exact counts/content/rowids/64-bit integer/blob/index/trigger preservation, no duplicate imports, no overwrite or changed-source resume.');
} finally {
  target.close();
}
