// node:sqlite is used only to read an existing backup. The app itself uses @libsql/client.
import { DatabaseSync } from 'node:sqlite';
import { createClient } from '@libsql/client';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const quote = name => '"' + name.replaceAll('"', '""') + '"';
const canonical = value => typeof value === 'bigint' ? {
  $integer: String(value)
} : value instanceof ArrayBuffer ? {
  $blob: Buffer.from(value).toString('base64')
} : ArrayBuffer.isView(value) ? {
  $blob: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64')
} : value;
const rowText = row => JSON.stringify(row.map(canonical)) + '\n';
function digest(rows) {
  const hash = createHash('sha256');
  for (const row of rows) hash.update(rowText(row));
  return hash.digest('hex');
}
export function readSnapshot(source) {
  const filename = resolve(source);
  if (!existsSync(filename)) throw new Error('Source SQLite file does not exist');
  const db = new DatabaseSync(filename, {
    readOnly: true
  });
  try {
    const quick = db.prepare('PRAGMA quick_check').get();
    if (Object.values(quick)[0] !== 'ok') throw new Error('Source SQLite integrity check failed');
    db.exec('BEGIN');
    const schema = db.prepare("SELECT type,name,tbl_name,sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_turso_import%' ORDER BY name").all(),
      tables = [];
    for (const entry of schema.filter(s => s.type === 'table')) {
      const info = db.prepare('PRAGMA table_info(' + quote(entry.name) + ')').all(),
        withoutRowid = /\bWITHOUT\s+ROWID\b/i.test(entry.sql),
        integerPrimaryKey = info.filter(c => c.pk).length === 1 && info.some(c => c.pk && c.type.toUpperCase() === 'INTEGER'),
        hasRowid = !withoutRowid && !integerPrimaryKey,
        columns = info.map(c => c.name),
        select = (hasRowid ? 'rowid AS __spokemon_rowid,' : '') + columns.map(quote).join(','),
        order = withoutRowid ? info.filter(c => c.pk).sort((a, b) => a.pk - b.pk).map(c => quote(c.name)).join(',') : 'rowid',
        statement = db.prepare('SELECT ' + select + ' FROM ' + quote(entry.name) + ' ORDER BY ' + order);
      statement.setReadBigInts(true);
      const rows = statement.all().map(r => [...(hasRowid ? [r.__spokemon_rowid] : []), ...columns.map(c => r[c])]);
      tables.push({
        ...entry,
        columns,
        hasRowid,
        select,
        order,
        rows,
        count: rows.length,
        digest: digest(rows),
        dependencies: db.prepare('PRAGMA foreign_key_list(' + quote(entry.name) + ')').all().map(r => r.table)
      });
    }
    db.exec('COMMIT');
    const ordered = [],
      visited = new Set(),
      active = new Set();
    function visit(table) {
      if (visited.has(table.name)) return;
      if (active.has(table.name)) throw new Error('Cyclic foreign keys require a custom migration');
      active.add(table.name);
      for (const name of table.dependencies) {
        const parent = tables.find(t => t.name === name);
        if (parent && parent !== table) visit(parent);
      }
      active.delete(table.name);
      visited.add(table.name);
      ordered.push(table);
    }
    tables.forEach(visit);
    const manifest = ordered.map(t => ({
        name: t.name,
        sql: t.sql,
        count: t.count,
        digest: t.digest
      })),
      extras = schema.filter(s => s.type !== 'table'),
      fingerprint = createHash('sha256').update(JSON.stringify({
        manifest,
        extras
      })).digest('hex');
    return {
      tables: ordered,
      extras,
      manifest,
      fingerprint
    };
  } finally {
    db.close();
  }
}
export async function migrateSqlite({
  source,
  target,
  dryRun = false,
  batchSize = 100,
  afterChunk = () => {}
}) {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error('batchSize must be 1..500');
  const snapshot = readSnapshot(source),
    report = {
      tables: snapshot.manifest.map(({
        name,
        count
      }) => ({
        name,
        count
      })),
      rows: snapshot.manifest.reduce((n, t) => n + t.count, 0)
    };
  if (dryRun) return {
    ...report,
    dryRun: true
  };
  if (!target) throw new Error('A target Turso client is required');
  const schema = (await target.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")).rows.map(r => r.name),
    markerExists = schema.includes('_turso_imports'),
    id = 'legacy-sqlite-v1';
  let prior = markerExists ? (await target.execute({
    sql: 'SELECT * FROM _turso_imports WHERE id=?',
    args: [id]
  })).rows[0] : null;
  if (prior && prior.fingerprint !== snapshot.fingerprint) throw new Error('Source changed since import started. Use the same stopped/backup source when resuming.');
  if (prior?.status === 'complete') return {
    ...report,
    alreadyComplete: true
  };
  if (!prior && schema.some(name => !['_turso_imports', '_turso_import_progress'].includes(name))) throw new Error('Target must be an empty database. Existing application data will not be overwritten.');
  if (!prior) {
    await target.batch(['CREATE TABLE IF NOT EXISTS _turso_imports(id TEXT PRIMARY KEY,fingerprint TEXT NOT NULL,status TEXT NOT NULL,started_at INTEGER NOT NULL,completed_at INTEGER)', 'CREATE TABLE IF NOT EXISTS _turso_import_progress(import_id TEXT NOT NULL,table_name TEXT NOT NULL,row_count INTEGER NOT NULL,PRIMARY KEY(import_id,table_name))', ...snapshot.tables.map(t => t.sql), {
      sql: 'INSERT INTO _turso_imports VALUES(?,?,?,?,NULL)',
      args: [id, snapshot.fingerprint, 'running', Date.now()]
    }], 'write');
  }
  for (const table of snapshot.tables) {
    let offset = Number((await target.execute({
      sql: 'SELECT row_count FROM _turso_import_progress WHERE import_id=? AND table_name=?',
      args: [id, table.name]
    })).rows[0]?.row_count ?? 0);
    const columns = [...(table.hasRowid ? ['rowid'] : []), ...table.columns],
      sql = 'INSERT INTO ' + quote(table.name) + ' (' + columns.map(quote).join(',') + ') VALUES (' + columns.map(() => '?').join(',') + ')';
    while (offset < table.rows.length) {
      const chunk = [];
      let bytes = 0;
      while (offset + chunk.length < table.rows.length && chunk.length < batchSize) {
        const row = table.rows[offset + chunk.length],
          size = Buffer.byteLength(rowText(row));
        if (chunk.length && bytes + size > 256000) break;
        chunk.push(row);
        bytes += size;
      }
      const next = offset + chunk.length;
      await target.batch([...chunk.map(args => ({
        sql,
        args
      })), {
        sql: 'INSERT INTO _turso_import_progress VALUES(?,?,?) ON CONFLICT(import_id,table_name) DO UPDATE SET row_count=excluded.row_count',
        args: [id, table.name, next]
      }], 'write');
      offset = next;
      await afterChunk({
        table: table.name,
        offset
      });
    }
  }
  for (const entry of snapshot.extras) {
    const sql = entry.sql.replace(/^CREATE\s+(UNIQUE\s+)?(INDEX|TRIGGER|VIEW)\s+(?!IF\s+NOT\s+EXISTS)/i, (_, unique = '', type) => 'CREATE ' + unique + type + ' IF NOT EXISTS ');
    await target.execute(sql);
  }
  for (const table of snapshot.tables) {
    const count = Number((await target.execute('SELECT COUNT(*) n FROM ' + quote(table.name))).rows[0].n);
    if (count !== table.count) throw new Error('Row count verification failed for ' + table.name);
    const hash = createHash('sha256');
    for (let offset = 0; offset < count; offset += batchSize) {
      const rs = await target.execute({
        sql: 'SELECT ' + table.select + ' FROM ' + quote(table.name) + ' ORDER BY ' + table.order + ' LIMIT ? OFFSET ?',
        args: [batchSize, offset]
      });
      for (const row of rs.rows) hash.update(rowText([...(table.hasRowid ? [row.__spokemon_rowid] : []), ...table.columns.map(c => row[c])]));
    }
    if (hash.digest('hex') !== table.digest) throw new Error('Content verification failed for ' + table.name);
  }
  const violations = await target.execute('PRAGMA foreign_key_check');
  if (violations.rows.length) throw new Error('Foreign key verification failed');
  await target.execute({
    sql: "UPDATE _turso_imports SET status='complete',completed_at=? WHERE id=?",
    args: [Date.now(), id]
  });
  return {
    ...report,
    complete: true
  };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (existsSync('.env')) process.loadEnvFile('.env');
  const args = process.argv.slice(2),
    source = args[args.indexOf('--source') + 1],
    dryRun = args.includes('--dry-run');
  let target;
  try {
    if (!args.includes('--source') || !source) throw new Error('Usage: npm run db:migrate -- --source /absolute/backup.sqlite [--dry-run]');
    if (!dryRun) {
      const url = process.env.TURSO_DATABASE_URL,
        authToken = process.env.TURSO_AUTH_TOKEN;
      if (!url || !authToken || !/^(libsql|https|wss):\/\//.test(url)) throw new Error('Set server-only TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
      target = createClient({
        url,
        authToken,
        intMode: 'bigint'
      });
    }
    const result = await migrateSqlite({
      source,
      target,
      dryRun
    });
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error(error.code ? 'Import failed: ' + error.code : error.message);
    process.exitCode = 1;
  } finally {
    target?.close();
  }
}
