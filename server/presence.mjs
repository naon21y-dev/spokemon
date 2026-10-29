import {itemMap} from '../src/data/items.js';
import {evolutionStage} from '../src/data/evolutions.js';
export async function createPresence(service) {
  const db = service.db;
  await db.exec('CREATE TABLE IF NOT EXISTS presence(user_id TEXT PRIMARY KEY REFERENCES users(id),seen_at INTEGER NOT NULL)');
  return {
    async touch(u, active) {
      if (u.role !== 'student') return {
        ok: true
      };
      if (active) await db.prepare('INSERT INTO presence VALUES (?,?) ON CONFLICT(user_id) DO UPDATE SET seen_at=excluded.seen_at').run(u.id, Date.now());else await db.prepare('DELETE FROM presence WHERE user_id=?').run(u.id);
      return {
        ok: true
      };
    },
    async list() {
      return {
        items: (await db.prepare("SELECT u.pet FROM presence p JOIN users u ON u.id=p.user_id WHERE p.seen_at>? AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM auth_sessions s WHERE s.user_id=u.id AND s.expires>?) ORDER BY p.seen_at DESC,u.login").all(Date.now() - 75000, Date.now())).map(u => {
          let character = 'piplup', stage = 1, wear = '';
          try {
            const pet=JSON.parse(u.pet);character=pet.character;stage=evolutionStage(pet);wear=itemMap[pet.wear]&&Array.isArray(pet.owned)&&pet.owned.includes(pet.wear)?pet.wear:'';
          } catch {}
          return {
            character, stage, wear
          };
        })
      };
    }
  };
}
