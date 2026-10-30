<script setup>
import {ref,watch,nextTick,onMounted,onUnmounted} from 'vue'
import {useArcade} from '../stores/arcade'
import {api} from '../lib/api'
const s=useArcade(),dialog=ref(null),entry=ref(null)
let generation=0,inflight='',checkedDay='',timer,alive=true,nextAttemptAt=0
const localDay=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date())
async function show(){await nextTick();if(alive&&entry.value&&dialog.value&&!dialog.value.open&&!document.querySelector('dialog[open]')&&!document.hidden)dialog.value.showModal()}
async function check(){
 if(document.hidden||s.user?.role!=='student'||checkedDay===localDay()||Date.now()<nextAttemptAt)return
 const user=s.user.id,current=generation,key=user+':'+current;if(inflight===key)return;inflight=key;nextAttemptAt=Date.now()+30000
 try{const result=await api('/attendance',{method:'POST'});if(!alive||current!==generation||s.user?.id!==user)return;checkedDay=result.day;if(result.awarded){entry.value=result;await s.refresh();show()}}
 catch{/* Retry on the next visible check without interrupting the game. */}finally{if(inflight===key)inflight=''}
}
function close(){entry.value=null;dialog.value?.close()}
function tick(){check();show()}
watch(()=>s.user?.id,()=>{generation++;checkedDay='';nextAttemptAt=0;close();check()},{immediate:true})
onMounted(()=>{check();timer=setInterval(tick,1000);document.addEventListener('visibilitychange',tick)})
onUnmounted(()=>{alive=false;generation++;clearInterval(timer);document.removeEventListener('visibilitychange',tick);dialog.value?.close()})
</script>
<template><dialog ref="dialog" class="attendance-popup" aria-label="7일 연속 출석" @cancel.prevent="close"><template v-if="entry"><button class="text-button attendance-close" aria-label="출석 팝업 닫기" @click="close">✕</button><p class="eyebrow">DAILY TRAINER CHECK-IN</p><h2>오늘도 만나서 반가워요!</h2><p><b>{{entry.streak}}일차 연속 출석</b> · {{entry.day}}</p><div class="attendance-stamps"><div v-for="day in 7" :key="day" :class="{stamped:day<=entry.streak,today:day===entry.streak}"><span>{{day}}일차</span><strong>{{day<=entry.streak?'✓':day===7?'🎁':'☆'}}</strong><small>{{day===7?'5P + 100P':'5P'}}</small></div></div><strong class="attendance-award">🪙 +{{entry.awarded}} P 지급 완료!</strong><p v-if="entry.streak===7">7일을 모두 채웠어요! 완주 보너스 100P를 받았어요.<br/>내일부터 새로운 1일차가 시작됩니다.</p><p v-else>매일 출석하면 5P! 7일을 채우면 보너스 100P!<br/>하루라도 빠지면 다음 출석은 1일차부터예요.</p><small>한국 시간 기준 하루 한 번 · 같은 날 재접속해도 중복 지급되지 않아요.</small><button class="attendance-confirm" @click="close">오늘도 모험 시작 →</button></template></dialog></template>
<style scoped>
.attendance-popup{box-sizing:border-box;width:min(650px,calc(100vw - 24px));max-height:90dvh;overflow:auto;color:var(--rpg-ink);background:var(--rpg-paper);border:3px solid var(--rpg-edge);border-radius:18px;padding:28px;text-align:center;box-shadow:inset 0 0 0 4px var(--rpg-bright),0 7px var(--rpg-shadow),0 20px 60px #0005}.attendance-popup::backdrop{background:#15233799;backdrop-filter:blur(3px)}.attendance-popup h2{font-size:23px;margin:12px 0}.attendance-popup p{font-size:13px;line-height:1.8}.attendance-close{position:absolute;top:10px;right:10px}.attendance-stamps{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;margin:24px 0}.attendance-stamps>div{display:flex;flex-direction:column;gap:9px;border:2px dashed var(--rpg-mid);border-radius:9px;padding:12px 3px;background:var(--rpg-soft);font-size:11px}.attendance-stamps strong{font-size:24px}.attendance-stamps small{font-size:9px}.attendance-stamps .stamped{border-style:solid;background:var(--rpg-bright)}.attendance-stamps .today{outline:3px solid var(--rpg-edge);outline-offset:2px}.attendance-award{display:block;font-size:24px;margin:22px 0}.attendance-popup>small{font-size:10px}.attendance-confirm{display:block;width:100%;margin:22px 0 0}@media(max-width:500px){.attendance-popup{padding:28px 16px 20px}.attendance-popup h2{font-size:19px}.attendance-stamps{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.attendance-stamps>div{padding:10px 3px}.attendance-popup p{font-size:12px}.attendance-award{font-size:20px}}
</style>
