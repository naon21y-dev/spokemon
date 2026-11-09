<script setup>
import {onMounted,ref} from 'vue'
import {api} from '../lib/api'
const enabled=ref(false),loaded=ref(false),busy=ref(false),error=ref(''),message=ref('')
onMounted(async()=>{try{enabled.value=(await api('/seeding/settings')).enabled;loaded.value=true}catch(e){error.value=e.message}})
async function toggle(){if(busy.value)return;busy.value=true;error.value='';message.value='';try{const result=await api('/admin/seeding',{method:'PUT',body:{enabled:!enabled.value}});enabled.value=result.enabled;message.value=result.enabled?'공개했어요. 학생들에게 팝업 알림을 보냅니다.':'숨겼어요. 메뉴와 문제 접근이 닫히며 기존 기록은 유지됩니다.'}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><section class="panel study-history"><h2>✨ GT's seeding 공개 설정</h2><p>25문제 일괄 제출마다 500P · 공부시간 합산 · 기존 누적 2시간 전설 조건 적용</p><p>시험이 끝나면 숨길 수 있어요. 다시 공개하면 학생들에게 새 팝업 알림을 보냅니다.</p><button :disabled="busy||!loaded" :aria-pressed="enabled" @click="toggle">{{enabled?'공개 중 · 숨기기':'숨김 중 · 공개하기'}}</button><p v-if="error" role="alert">{{error}}</p><p v-if="message" role="status">{{message}}</p></section></template>
