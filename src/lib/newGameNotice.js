export const noticeDay=(now=Date.now())=>new Date(now+9*3600000).toISOString().slice(0,10)
export const noticeKey=userId=>'spokemon-new-game:python-dungeon-v1:'+userId
export function isNoticeHidden(storage,userId,now=Date.now()){try{return storage.getItem(noticeKey(userId))===noticeDay(now)}catch{return false}}
export function hideNoticeToday(storage,userId,now=Date.now()){try{storage.setItem(noticeKey(userId),noticeDay(now))}catch{}}
