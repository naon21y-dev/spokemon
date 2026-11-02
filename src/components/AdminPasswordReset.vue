<script setup>
import {ref,onUnmounted} from 'vue'
import {api} from '../lib/api'
const props=defineProps({student:{type:Object,required:true}}),dialog=ref(null),busy=ref(false),error=ref(''),notice=ref('');let requestKey=''
function open(){requestKey=crypto.randomUUID();error.value='';notice.value='';dialog.value.showModal()}
async function reset(){if(busy.value)return;busy.value=true;error.value='';try{const r=await api('/admin/students/'+props.student.id+'/password-reset',{method:'POST',body:{confirmLogin:props.student.login,requestKey}});notice.value=r.duplicate?'이미 처리한 초기화입니다.':'비밀번호가 123456789a로 초기화되었습니다. 학생에게 로그인 후 재설정을 안내해 주세요.';dialog.value.close()}catch(e){error.value=e.message}finally{busy.value=false}}
onUnmounted(()=>dialog.value?.close())
</script>
<template><button class="light admin-password-reset" @click="open">비밀번호 초기화</button><small v-if="notice" role="status" class="password-reset-notice">{{notice}}</small><dialog ref="dialog" class="ticket-dialog" aria-label="학생 비밀번호 초기화" @cancel.prevent="!busy&&dialog.close()"><h2>학생 비밀번호를 초기화할까요?</h2><p>{{student.nickname??student.name}} · @{{student.login}}</p><p>초기 비밀번호: <strong>123456789a</strong></p><p>해당 학생의 기존 로그인 세션이 모두 해제됩니다. 포인트·학습 기록·아이템은 유지됩니다.</p><p v-if="error" role="alert">{{error}}</p><div class="toolbar"><button :disabled="busy" @click="reset">{{busy?'초기화 중…':'123456789a로 초기화'}}</button><button class="light" :disabled="busy" @click="dialog.close()">취소</button></div></dialog></template>
<style scoped>
.admin-password-reset{font-size:11px;white-space:nowrap;margin:4px 4px 4px 0}.password-reset-notice{display:block;font-size:11px;line-height:1.7;max-width:230px;white-space:normal}
</style>
