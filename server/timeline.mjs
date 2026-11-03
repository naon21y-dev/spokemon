import {fail} from './service.mjs'
import {legendaryName} from './legendary.mjs'

const updates = [
  ['update:timeline-v1', Date.parse('2026-11-03T00:00:00+09:00'), '활동 타임라인이 열렸어요!', '새 댓글과 포켓몬 획득 기록, Spokemon 업데이트를 한곳에서 확인할 수 있어요.']
]

export function createTimeline(service) {
  const db = service.db
  const events = `WITH events(id, kind, at, title, detail, target, notify) AS (
    VALUES ${updates.map(() => "(?, 'update', ?, ?, ?, NULL, 1)").join(',')}
    UNION ALL
    SELECT 'comment:'||c.id, CASE WHEN c.author=? THEN 'comment-written' ELSE 'comment-received' END,
      c.created_at,p.title,u.name,p.id,c.author<>?
    FROM sloud_comments c JOIN sloud_posts p ON p.id=c.post_id
    JOIN users u ON u.id=c.author JOIN users author ON author.id=p.author
    WHERE (c.author=? OR p.author=?) AND c.deleted_at IS NULL AND p.deleted_at IS NULL
      AND u.deleted_at IS NULL AND author.deleted_at IS NULL
    UNION ALL
    SELECT 'legendary:'||species,'legendary',captured_at,species,'',NULL,1
    FROM legendary_owned WHERE user_id=?
  )`
  const args = u => [...updates.flat(),u.id,u.id,u.id,u.id,u.id]
  const unread = "e.notify=1 AND NOT EXISTS(SELECT 1 FROM activity_receipts r WHERE r.user_id=? AND r.event_id=e.id)"

  async function list(u, page) {
    service.student(u)
    const {count} = await db.prepare(events+' SELECT count(*) count FROM events e WHERE '+unread).get(...args(u),u.id)
    if (page === null) return {unread:count}
    const offset = Math.max(0, Math.min(9999, Number.parseInt(page,10) || 0))
    const rows = await db.prepare(events+` SELECT e.*, (${unread}) AS unread FROM events e ORDER BY at DESC,id DESC LIMIT 31 OFFSET ?`).all(...args(u),u.id,offset)
    return {unread:count, more:rows.length>30, items:rows.slice(0,30).map(row=>row.kind==='legendary'?{...row,title:legendaryName(row.title)}:row)}
  }

  async function readAll(u) {
    service.student(u)
    await db.prepare(events+' INSERT OR IGNORE INTO activity_receipts(user_id,event_id) SELECT ?,id FROM events WHERE notify=1').run(...args(u),u.id)
    return {ok:true}
  }

  return {list,readAll}
}
