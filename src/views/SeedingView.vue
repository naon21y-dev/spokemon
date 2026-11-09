<script setup>
import {computed,onMounted,onUnmounted,ref,watch} from 'vue'
import {api} from '../lib/api'
import {useArcade} from '../stores/arcade'
import {useStudyActivity} from '../composables/useStudyActivity'
const arcade=useArcade(),enabled=ref(false),loaded=ref(false),session=ref(null),answers=ref({}),busy=ref(false),error=ref(''),saving=ref(false),saveLabel=ref('서버에 자동 저장됩니다'),form=ref(null)
const count=computed(()=>session.value?.questions.filter(q=>answers.value[q.id]?.trim()).length??0)
let timer,poll,pending=Promise.resolve(),disposed=false
function accept(data){session.value=data;answers.value={...(data?.answers??{})}}
async function load(){try{const data=await api('/seeding');enabled.value=data.enabled;accept(data.session);loaded.value=true}catch(e){error.value=e.message}}
async function start(){if(busy.value)return;busy.value=true;error.value='';try{accept(await api('/seeding/start',{method:'POST',body:{}}));saveLabel.value='서버에 자동 저장됩니다'}catch(e){error.value=e.message}finally{busy.value=false}}
function save(){
 clearTimeout(timer)
 pending=pending.catch(()=>{}).then(async()=>{
  const current=session.value;if(!enabled.value||!current||current.result)return
  const snapshot={...answers.value};if(JSON.stringify(snapshot)===JSON.stringify(current.answers))return
  saving.value=true
  try{const data=await api('/seeding/'+current.id+'/draft',{method:'POST',body:{answers:snapshot,revision:current.revision},keepalive:disposed});if(session.value?.id===current.id){current.revision=data.revision;current.answers=data.answers;saveLabel.value='자동 저장 완료'}return true}
  catch(e){error.value=e.message;saveLabel.value='저장 실패 · 다시 시도해 주세요';throw e}finally{saving.value=false}
 })
 return pending
}
watch(answers,()=>{clearTimeout(timer);if(!session.value?.result){saveLabel.value='저장 대기 중…';timer=setTimeout(()=>save().catch(()=>{}),900)}},{deep:true})
async function submit(){if(busy.value||count.value!==30)return;if(!form.value.reportValidity())return;busy.value=true;error.value='';try{await save();const data=await api('/seeding/'+session.value.id+'/submit',{method:'POST',body:{answers:answers.value,revision:session.value.revision}});accept(data);await arcade.refresh();window.dispatchEvent(new Event('spokemon-points-refresh'));window.scrollTo({top:0,behavior:'smooth'})}catch(e){error.value=e.message}finally{busy.value=false}}
useStudyActivity(()=>enabled.value&&session.value&&!session.value.result?{kind:'seeding',sessionId:session.value.id}:null)
onMounted(()=>{load();poll=setInterval(async()=>{try{enabled.value=(await api('/seeding/settings',{background:true})).enabled}catch{}},15000)})
onUnmounted(()=>{disposed=true;clearTimeout(timer);clearInterval(poll);save().catch(()=>{})})
</script>
<template><section class="seeding-page">
 <header class="panel seed-banner"><span class="eyebrow">SPECIAL STUDY CHALLENGE</span><h1>✨ GT's seeding</h1><h2>열심히 해서 1시드를 노려보세요!!!!</h2><p>아 공부 안 하게? 안 하게? 안 하게? 안 하게? 안 하게?<br>4시드 가게? 4시드? 1시드 안 하게? 1시드 놓치게?</p><div class="seed-perks"><span>한 번에 30문제</span><span>완료마다 500P</span><span>공부시간 합산 · 누적 2시간 전설 도전</span></div></header>
 <p v-if="error" class="notice" role="alert">{{error}}</p><p v-if="!loaded">문제를 준비하고 있어요…</p>
 <section v-else-if="!enabled" class="panel"><h2>지금은 준비 중이에요.</h2><p>관리자가 공개하면 다시 도전할 수 있어요. 풀이 기록과 보상은 유지됩니다.</p></section>
 <template v-else><section v-if="!session" class="panel seed-start"><h2>AI · 딥러닝 · CNN 집중 연습</h2><p>첨부 학습 자료를 바탕으로 구성한 문제에서 30문제를 무작위로 골라요. 모든 문제를 한 화면에서 풀고 한꺼번에 제출하세요.</p><p>정답과 해설은 전체 제출 후 공개돼요. 30문제 전체에 답하면 정답 수와 관계없이 500P를 받습니다.</p><p>기존 퀴즈·학습하기와 공부시간을 합산합니다. 누적 2시간 초과 시 기존 전설 도감의 공부시간 보상을 받을 수 있어요(계정당 해당 조건 1회).</p><button :disabled="busy" @click="start">30문제 도전 시작!</button></section>
 <template v-else><section v-if="session.result" class="panel seed-result" role="status"><h2>30문제 도전 완료! +500P</h2><p>{{session.result.correct}} / 30문제 정답 · {{session.result.score}}점</p><p>아래에서 제출한 답안과 정답·해설을 함께 확인하세요.</p><button :disabled="busy" @click="start">새로운 30문제 도전</button><RouterLink to="/legendary" class="button light">전설 도감 확인</RouterLink></section>
 <form ref="form" @submit.prevent="submit"><div class="seed-progress"><b>{{session.result?'제출 완료':count+' / 30문제 작성'}}</b><small role="status">{{session.result?'500P 지급 완료':saving?'저장 중…':saveLabel}}</small><button v-if="!session.result" type="button" class="light" :disabled="busy||saving" @click="save().catch(()=>{})">지금 저장</button></div>
 <div class="seed-questions"><article v-for="(q,index) in session.questions" :key="q.id" class="panel seed-question" :class="session.result?{right:session.result.items[index].correct,wrong:!session.result.items[index].correct}:{}"><h2><span>Q{{String(index+1).padStart(2,'0')}}</span> {{q.prompt}}</h2><pre v-if="q.code"><code>{{q.code}}</code></pre><label :for="q.id">{{session.result?'내가 제출한 답':'답안'}}<input :id="q.id" v-model="answers[q.id]" :disabled="busy||!!session.result" required maxlength="200" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="답안을 입력하세요"></label><div v-if="session.result" class="seed-feedback"><b>{{session.result.items[index].correct?'✓ 정답':'다시 기억해 봐요'}}</b><p>정답: {{q.correctAnswer}}</p><p>{{q.explanation}}</p></div></article></div>
 <section v-if="!session.result" class="panel seed-submit"><p>{{count===30?'모든 답안을 작성했어요! 제출하면 정답·해설과 500P를 받습니다.':'아직 '+(30-count)+'문제가 남았어요. 답안을 모두 작성해 주세요.'}}</p><small>영문 대소문자·공백은 무시합니다. 여러 빈칸은 문제 안내에 따라 쉼표로 구분하세요.</small><button :disabled="busy||count!==30">{{busy?'제출 중…':'30문제 한꺼번에 제출 · 500P 받기'}}</button></section></form>
 </template></template>
</section></template>
<style scoped>
.seeding-page{width:100%;min-width:0;max-width:1200px;margin:auto}.seeding-page>header.seed-banner{display:block;width:100%;box-sizing:border-box}.seed-banner{background:linear-gradient(135deg,var(--rpg-soft),var(--rpg-bright));border:3px solid var(--rpg-edge);overflow:hidden}.seed-banner h1{font-size:clamp(25px,4vw,38px);margin:10px 0}.seed-banner h2{font-size:clamp(17px,2.6vw,23px)}.seed-banner p{line-height:1.9}.seed-perks{display:flex;flex-wrap:wrap;gap:9px}.seed-perks span{padding:7px 10px;border:1px solid var(--rpg-mid);background:var(--rpg-paper);font-size:12px}.seed-progress{display:flex;align-items:center;gap:12px;flex-wrap:wrap;padding:14px 0}.seed-progress small{margin-right:auto}.seed-questions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;align-items:start}.seed-question{min-width:0;margin:0!important;padding:20px!important}.seed-question h2{font-size:15px;line-height:1.8;overflow-wrap:anywhere;margin:0 0 14px}.seed-question h2 span{color:var(--rpg-edge)}.seed-question pre{max-width:100%;overflow:auto;box-sizing:border-box;padding:12px;background:#182539;color:#f0f5ff;border-radius:5px;font:12px/1.7 monospace;white-space:pre;tab-size:2}.seed-question label{display:grid;gap:8px;font-size:12px}.seed-question input{min-width:0;width:100%;box-sizing:border-box;margin:0;font-size:14px}.seed-feedback{line-height:1.8;font-size:12px;overflow-wrap:anywhere;padding-top:12px}.seed-question.right{border-color:#337c55}.seed-question.wrong{border-color:#bd7440}.seed-submit{margin-top:20px;display:grid;gap:14px}.seed-submit button{justify-self:start;max-width:100%;white-space:normal}.seed-result{margin-bottom:20px}.seed-start p{line-height:1.9}h1,h2,p{overflow-wrap:anywhere}@media(max-width:700px){.seed-questions{grid-template-columns:minmax(0,1fr)}.seed-question{padding:15px!important}.seed-perks span{font-size:10px}.seed-progress{font-size:12px}.seed-banner{padding:20px!important}}
</style>
