<script setup>
import {computed,nextTick,onMounted,onUnmounted,ref,watch} from 'vue'
import PartnerImage from './PartnerImage.vue'
const props=defineProps({result:{type:Object,default:null}}),emit=defineEmits(['close','retry']),dialog=ref(null)
const retake=computed(()=>props.result?.outcome==='retake'||props.result?.score<=60)
function sync(){if(!dialog.value)return;if(!props.result){dialog.value.close();return}if(!document.hidden&&!dialog.value.open&&!document.querySelector('dialog[open]')){dialog.value.showModal();dialog.value.scrollTop=0}}
watch(()=>props.result,async()=>{await nextTick();sync()});let timer
onMounted(()=>{timer=setInterval(sync,300);sync()});onUnmounted(()=>{clearInterval(timer);dialog.value?.close()})
</script>
<template><dialog ref="dialog" class="seeding-result-popup" aria-label="GT's seeding 결과" @cancel.prevent="emit('close')"><template v-if="result">
 <button type="button" class="text-button result-close" aria-label="결과 팝업 닫기" @click="emit('close')">✕</button>
 <p class="eyebrow">GT'S SEEDING RESULT</p><h2>{{retake?'재시험 당첨!':'통과했어요! ♥'}}</h2>
 <div class="result-scene" :class="{rainy:retake}" :data-effect="retake?'rain':'hearts'" aria-hidden="true">
  <div v-if="retake" class="result-rain"><span>☁ ☁ ☁</span><i v-for="i in 30" :key="i" :style="{left:(i*29%100)+'%','--i':i}"/></div>
  <div v-else class="result-hearts"><span v-for="i in 12" :key="i" :style="{left:(10+i*23%80)+'%',top:(20+i*19%65)+'%','--i':i}">♥</span></div>
  <PartnerImage/>
 </div>
 <p class="result-score">{{result.score}}<small> / 100점</small></p><p>{{result.correct}} / {{result.total}}문제 정답 · 완료 보상 +{{result.coins}}P</p>
 <p>{{retake?'비가 주룩주룩… 해설을 복습하고 재시험에 도전해 봐요!':'하트 팡팡! 오늘도 한 단계 성장했어요!'}}</p><small>60점 이하는 재시험 · 60점 초과는 통과</small>
 <div class="toolbar"><button type="button" @click="emit('close')">점수·해설 확인</button><button v-if="retake" type="button" class="light" @click="emit('retry')">재시험 도전</button></div>
 </template></dialog></template>
<style scoped>
.seeding-result-popup{position:fixed;inset:0;margin:auto;box-sizing:border-box;width:min(480px,calc(100vw - 28px));max-width:none;max-height:90dvh;overflow:auto;padding:26px;background:var(--rpg-paper);color:var(--rpg-ink);border:3px solid var(--rpg-edge);border-radius:16px;box-shadow:inset 0 0 0 4px var(--rpg-bright),0 7px 0 var(--rpg-shadow);text-align:center}.seeding-result-popup::backdrop{background:#152338bb;backdrop-filter:blur(3px)}.result-close{position:absolute;top:9px;right:10px}.seeding-result-popup h2{font-size:25px;margin:12px 0}.seeding-result-popup p{font-size:13px;line-height:1.8;overflow-wrap:anywhere}.seeding-result-popup small{font-size:11px}.result-scene{height:180px;position:relative;overflow:hidden;border-radius:12px;isolation:isolate;background:radial-gradient(ellipse,var(--rpg-bright),transparent 75%)}.result-scene.rainy{background:linear-gradient(#405a77,#809fb7)}.result-scene :deep(img){position:absolute;z-index:1;left:25%;bottom:8px;width:50%;height:140px;object-fit:contain;filter:none}.result-rain,.result-hearts{position:absolute;inset:0;z-index:2;pointer-events:none}.result-rain>span{position:absolute;top:0;left:0;right:0;font-size:38px;color:#c3d3df;letter-spacing:10px}.result-rain>i{position:absolute;width:2px;height:25px;top:-30px;background:linear-gradient(transparent,#c0e2ff);animation:seeding-rain .8s calc(var(--i)*-.031s) linear infinite}.result-hearts>span{position:absolute;color:#ee557c;font-family:'Segoe UI Emoji',sans-serif;font-size:28px;animation:seeding-heart 1.4s calc(var(--i)*-.12s) ease-out infinite}.seeding-result-popup .result-score{font-size:46px;font-weight:bold;margin:12px 0;line-height:1.2}.result-score small{font-size:16px}.seeding-result-popup .toolbar{justify-content:center;flex-wrap:wrap;margin-top:20px}.seeding-result-popup .toolbar button{white-space:normal;max-width:100%}@keyframes seeding-rain{to{transform:translate(-15px,230px)}}@keyframes seeding-heart{to{transform:translateY(-75px) scale(.7);opacity:.1}}@media(prefers-reduced-motion:reduce){.result-rain>i,.result-hearts>span{animation:none}.result-rain>i{top:30%}}@media(max-width:480px){.seeding-result-popup{padding:24px 16px}.seeding-result-popup h2{font-size:22px}.result-scene{height:155px}.result-scene :deep(img){height:120px}.seeding-result-popup .result-score{font-size:40px}}
</style>
