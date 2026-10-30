import {itemMap} from '../src/data/items.js';
import {evolutionStage,evolvedCharacter} from '../src/data/evolutions.js';
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
    async list(u) {
      if(u)service.admin(u);
      return {
        items: (await db.prepare("SELECT u.pet,u.id,u.login,u.name,c.name AS class_name FROM presence p JOIN users u ON u.id=p.user_id LEFT JOIN classes c ON c.id=u.class_id WHERE p.seen_at>? AND u.deleted_at IS NULL AND EXISTS(SELECT 1 FROM auth_sessions s WHERE s.user_id=u.id AND s.expires>?) ORDER BY p.seen_at DESC,u.login").all(Date.now() - 75000, Date.now())).map(person => {
          let character = 'piplup', stage = 1, wear = '',formId='';
          try {
            const pet=JSON.parse(person.pet);character=pet.character;stage=evolutionStage(pet);formId=character==='diglett'&&stage===2?evolvedCharacter(pet).formId:'';wear=itemMap[pet.wear]&&Array.isArray(pet.owned)&&pet.owned.includes(pet.wear)?pet.wear:'';
          } catch {}
          return {
            character, stage, wear, ...(formId?{formId}:{}), ...(u ? {id:person.id,login:person.login,nickname:person.name,className:person.class_name??'미배정'} : {})
          };
        })
      };
    }
  };
}
