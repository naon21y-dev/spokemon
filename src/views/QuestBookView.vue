<script setup>
import {ref,computed,onMounted} from 'vue'
import {api} from '../lib/api'
import {useQuests} from '../stores/quests'
import {useArcade} from '../stores/arcade'
const s=useArcade(),book=ref({units:[]}),subject=ref(''),unit=ref(''),busy=ref(false),claiming=ref(''),error=ref(''),notice=ref('')
const subjects=computed(()=>[...new Map(book.value.units.map(u=>[u.subject,u.subjectName])).entries()]),units=computed(()=>book.value.units.filter(u=>(!subject.value||u.subject===subject.value)&&(!unit.value||String(u.unit)===unit.value))),choices=computed(()=>book.value.units.filter(u=>u.subject===subject.value))
async function load(){busy.value=true;error.value='';try{book.value=await api('/quests');useQuests().accept(book.value);}catch(e){error.value=e.message}finally{busy.value=false}}
async function claim(q){if(claiming.value)return;claiming.value=q.id;error.value='';notice.value='';try{const r=await api('/quests/claim',{method:'POST',body:{questId:q.id}});notice.value=r.awarded?`퀘스트 완료! ${r.awarded}P를 받았어요.`:'이미 보상을 받았어요.';await Promise.all([load(),s.refresh()])}catch(e){error.value=e.message}finally{claiming.value=''}}
async function claimAll(){if(claiming.value||busy.value)return;claiming.value='all';error.value='';notice.value='';try{const result=await api('/quests/claim-all',{method:'POST',body:{}});notice.value=result.count?`퀘스트 ${result.count}개 보상 ${result.awarded}P를 한 번에 받았어요!`:'수령할 보상이 없어요.';await Promise.all([load(),s.refresh()])}catch(e){error.value=e.message}finally{claiming.value=''}}
const expanded = ref('')
const unitKey = entry => JSON.stringify([entry.subject,entry.unit])
const completed = entry => entry.quests.filter(quest=>quest.progress>=quest.target).length
const ready = entry => entry.quests.filter(quest=>quest.ready).length
function toggle(entry) {
  const key = unitKey(entry)
  expanded.value = expanded.value === key ? '' : key
}
function changeSubject() {
  unit.value = ''
  expanded.value = ''
}
function changeUnit() {
  expanded.value = unit.value ? JSON.stringify([subject.value,Number(unit.value)]) : ''
}
onMounted(load)
</script>
<template><section class="quest-book"><div class="quest-book-heading"><div><p class="eyebrow">MY QUEST BOOK</p><h1>📖 퀘스트북</h1><p>단원마다 10개의 모험! 퀴즈·복습에서 서로 다른 문제를 맞혀 보세요.</p></div><RouterLink class="button light" to="/quiz">퀴즈 풀러 가기 →</RouterLink></div><div class="panel quest-controls"><label>과목<select v-model="subject" @change="changeSubject"><option value="">전체 과목</option><option v-for="[id,name] in subjects" :key="id" :value="id">{{name}}</option></select></label><label>단원<select v-model="unit" :disabled="!subject" @change="changeUnit"><option value="">전체 단원</option><option v-for="u in choices" :key="u.unit" :value="String(u.unit)">{{u.title}}</option></select></label><button :disabled="busy||!!claiming" @click="load">새로고침</button></div><div class="quest-claim-all panel"><div><b>수령 가능한 보상 {{book.ready??0}}개</b><small>선택한 필터와 관계없이 모든 과목의 수령 가능한 보상을 받아요.</small></div><button :disabled="busy||!!claiming||!book.ready" @click="claimAll">{{claiming==='all'?'일괄 수령 중…':'완료 보상 일괄 수령'}}</button></div><p class="quest-help">기존 퀴즈 기록도 반영돼요. 같은 문제의 반복 정답·수정 버전은 한 문제로 계산하며, 각 퀘스트 보상은 한 번만 받을 수 있어요. 학습자료의 완료 표시는 정답 수에 포함되지 않아요.</p><p v-if="error" role="alert" class="notice">{{error}}</p><p v-if="notice" role="status" class="notice">{{notice}}</p><p v-if="busy" role="status">퀘스트북을 불러오고 있어요…</p><p v-else-if="!units.length">등록된 단원이 없어요.</p><section v-for="u in units" :key="unitKey(u)" class="panel quest-unit">
  <button type="button" class="quest-unit-toggle" :aria-expanded="expanded===unitKey(u)" @click="toggle(u)">
    <span class="quest-unit-title"><small>{{u.subjectName}}</small><strong>{{u.title}}</strong></span>
    <span class="quest-unit-status">{{u.locked?'🔒 공개 대기':ready(u)?'수령 가능 '+ready(u)+'개':'목표 달성 '+completed(u)+' / '+u.quests.length}}</span>
    <span aria-hidden="true">{{expanded===unitKey(u)?'−':'+'}}</span>
  </button>
  <div v-if="expanded===unitKey(u)" class="quest-unit-content">
    <p v-if="u.locked">아직 배우지 않은 단원이에요. 공개되면 도전할 수 있어요.</p>
    <template v-else>
      <div class="quest-unit-meta">
        <span>정답 {{u.correct}} / {{u.total}} · 보상 수령 {{u.quests.filter(q=>q.claimed).length}} / {{u.quests.length}}</span>
        <RouterLink class="button light" :to="{path:'/quiz',query:{subject:u.subject,unit:u.unit}}">이 단원 퀴즈 도전 →</RouterLink>
      </div>
      <ol class="quest-list">
        <li v-for="q in u.quests" :key="q.id" :class="{ready:q.ready}">
          <span class="quest-tier">{{String(q.tier).padStart(2,'0')}}</span>
          <strong class="quest-goal">{{q.title}}</strong>
          <div class="quest-progress"><progress :aria-label="q.title+' 진행률'" :value="q.progress" :max="q.target"/><small>{{q.progress}} / {{q.target}}</small></div>
          <span class="quest-reward">{{q.reward}} P</span>
          <button v-if="q.ready" :disabled="!!claiming" @click="claim(q)">{{claiming===q.id?'수령 중…':'보상 받기'}}</button>
          <span v-else class="quest-status">{{q.claimed?'✓ 수령 완료':'진행 중'}}</span>
        </li>
      </ol>
    </template>
  </div>
</section></section></template>
<style scoped>
.quest-claim-all{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:14px 16px}.quest-claim-all small{display:block;margin-top:8px;font-size:11px;line-height:1.6}.quest-book{max-width:1500px;margin:auto}.quest-book-heading,.quest-controls{display:flex;justify-content:space-between;align-items:center;gap:16px;flex-wrap:wrap}.quest-book-heading h1{margin:6px 0}.quest-controls{margin:16px 0;padding:16px}.quest-controls label{flex:1;min-width:180px}.quest-controls select{width:100%;margin-top:6px}.quest-help{font-size:.9rem;line-height:1.7}.quest-unit{margin:9px 0;padding:0}
.quest-unit-toggle{display:grid;grid-template-columns:minmax(0,1fr) auto 1em;gap:12px;align-items:center;width:100%;padding:12px 16px;text-align:left;background:transparent!important;color:var(--rpg-ink)!important;border:0!important;box-shadow:none!important}
.quest-unit-title{display:grid;gap:3px;min-width:0;overflow-wrap:anywhere}
.quest-unit-title small,.quest-unit-status{font-size:11px}
.quest-unit-content{padding:12px 16px 16px;border-top:1px solid var(--rpg-mid)}
.quest-unit-content p{margin:0}
.quest-unit-meta{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:12px;font-size:12px}
.quest-list{list-style:none;display:grid;gap:4px;padding:0;margin:0}
.quest-list li{display:grid;grid-template-columns:2ch minmax(0,1fr) minmax(70px,1fr) 6ch 100px;gap:12px;align-items:center;padding:8px 10px;border-radius:6px;font-size:12px}
.quest-list li:nth-child(odd),.quest-list li.ready{background:var(--rpg-soft)}
.quest-list li button{padding:6px 8px;font-size:11px}
.quest-tier,.quest-reward,.quest-status,.quest-progress small{font-variant-numeric:tabular-nums;white-space:nowrap}
.quest-status{text-align:center}
.quest-progress{display:flex;align-items:center;gap:6px;min-width:0}
.quest-progress progress{width:100%;min-width:0;height:8px;margin:0}
.quest-goal{overflow-wrap:anywhere}
@media(max-width:600px){
 .quest-controls{align-items:stretch}.quest-controls label{min-width:100%}
 .quest-unit-toggle{padding:10px;gap:8px}
 .quest-unit-content{padding:10px}
 .quest-list li{grid-template-columns:2ch minmax(0,1fr) 6ch 86px;gap:6px}
 .quest-progress{grid-column:2;grid-row:2}
 .quest-reward{grid-column:3;grid-row:1}
 .quest-status,.quest-list li button{grid-column:4;grid-row:1 / span 2}
}
</style>
