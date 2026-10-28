import { createClient } from '@libsql/client';
import { AsyncLocalStorage } from 'node:async_hooks';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const gates = new Map();
export function databaseConfig(filename, env = process.env) {
  if (filename === undefined && env.TURSO_AUTH_TOKEN && !env.TURSO_DATABASE_URL) throw new Error('TURSO_DATABASE_URL is required when TURSO_AUTH_TOKEN is set');
  if (filename === undefined && env.TURSO_DATABASE_URL) {
    if (!/^(libsql|https|wss):\/\//.test(env.TURSO_DATABASE_URL)) throw new Error('TURSO_DATABASE_URL must be a remote libsql/https/wss URL');
    if (!env.TURSO_AUTH_TOKEN) throw new Error('TURSO_AUTH_TOKEN is required');
    return {
      url: env.TURSO_DATABASE_URL,
      authToken: env.TURSO_AUTH_TOKEN,
      intMode: 'number'
    };
  }
  if (filename === undefined && (env.RENDER === 'true' || env.NODE_ENV === 'production') && env.NODE_ENV !== 'test') throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required in production; local fallback is disabled');
  const file = filename ?? env.SPOKEMON_DB ?? 'server/data/spokemon.sqlite';
  if (file === ':memory:') return {
    url: 'file::memory:',
    intMode: 'number'
  };
  const absolute = resolve(file);
  mkdirSync(dirname(absolute), {
    recursive: true
  });
  return {
    url: pathToFileURL(absolute).href,
    intMode: 'number'
  };
}
export async function openDatabase(filename, {
  client: injectedClient,
  config
} = {}) {
  const settings = config ?? databaseConfig(filename),
    client = injectedClient ?? createClient(settings),
    context = new AsyncLocalStorage(),
    key = settings.url === 'file::memory:' ? Symbol('memory') : settings.url;
  if (!gates.has(key)) gates.set(key, Promise.resolve());
  async function locked(fn) {
    const before = gates.get(key);
    let release;
    const next = new Promise(r => release = r);
    gates.set(key, next);
    await before;
    try {
      return await fn();
    } finally {
      release();
    }
  }
  const args = values => values.map(v => v === undefined ? null : typeof v === 'boolean' ? Number(v) : v);
  const rows = result => result.rows.map(row => Object.fromEntries(result.columns.map(column => [column, row[column]])));
  async function execute(sql, values = []) {
    const active = context.getStore();
    if (active) return active.execute({
      sql,
      args: args(values)
    });
    return locked(() => client.execute({
      sql,
      args: args(values)
    }));
  }
  const db = {
    prepare(sql) {
      return {
        get: async (...values) => rows(await execute(sql, values))[0],
        all: async (...values) => rows(await execute(sql, values)),
        run: async (...values) => {
          const result = await execute(sql, values);
          return {
            changes: result.rowsAffected,
            lastInsertRowid: result.lastInsertRowid
          };
        }
      };
    },
    async exec(sql) {
      const active = context.getStore();
      if (active) return active.executeMultiple(sql);
      return locked(() => client.executeMultiple(sql));
    },
    async batch(statements) {
      const active = context.getStore();
      if (active) return active.batch(statements);
      return locked(() => client.batch(statements, 'write'));
    },
    async transaction(fn) {
      if (context.getStore()) return fn();
      return locked(async () => {
        const transaction = await client.transaction('write');
        try {
          const value = await context.run(transaction, fn);
          await transaction.commit();
          return value;
        } catch (error) {
          try {
            if (!transaction.closed) await transaction.rollback();
          } catch {}
          throw error;
        } finally {
          transaction.close();
        }
      });
    },
    async close() {
      await locked(() => client.close());
    },
    protocol: client.protocol
  };
  try {
    if (settings.url.startsWith('file:')) await db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
    const marker = await db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_turso_imports'").get();
    if (marker) {
      const incomplete = await db.prepare("SELECT id FROM _turso_imports WHERE status<>'complete' LIMIT 1").get();
      if (incomplete) throw new Error('SQLite import is incomplete. Resume the import before starting the app.');
    }
    await db.prepare('SELECT 1 AS connected').get();
    return db;
  } catch (error) {
    client.close();
    throw error;
  }
}
