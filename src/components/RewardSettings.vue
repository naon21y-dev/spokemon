<script setup>
import {ref,onMounted} from 'vue'
import {api} from '../lib/api'
const settings=ref(null),busy=ref(false),error=ref(''),message=ref('')
onMounted(async()=>{try{settings.value=await api('/reward-settings')}catch(e){error.value=e.message}})
async function save(){if(busy.value)return;busy.value=true;error.value='';message.value='';try{settings.value=await api('/admin/reward-settings',{method:'PUT',body:settings.value});message.value='보상 설정을 저장했습니다. 이후 정답 제출부터 적용합니다.'}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><section class="panel reward-settings"><h2>퀴즈 포인트 설정</h2><form v-if="settings" class="mistake-filters" @submit.prevent="save"><label>공식 문제 최초 정답<input v-model.number="settings.official" type="number" min="0" max="100000" step="1" required/></label><label>학생 제작 문제 최초 정답<input v-model.number="settings.student" type="number" min="0" max="100000" step="1" required/></label><label>학생 문제 하루 최대 포인트<input v-model.number="settings.dailyCap" type="number" min="0" max="100000" step="1" required/></label><button :disabled="busy">{{busy?'저장 중…':'보상 설정 저장'}}</button></form><p class="chart-note">자기 문제는 미지급 · 원본당 한 번 · 한국 시간 기준 일일 한도 · 일반 게임 미지급. 한도보다 적게 남으면 일부 지급하며, 한도가 0이면 다음 날 다시 도전할 수 있습니다. 기존 보상은 변경하지 않습니다.</p><p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p></section></template>
