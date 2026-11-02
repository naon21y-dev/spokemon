<script setup>
import {ref,onUnmounted} from 'vue'
import {useRouter} from 'vue-router'
import {useArcade} from '../stores/arcade'
import {api} from '../lib/api'
const s=useArcade(),router=useRouter(),dialog=ref(null),current=ref(''),password=ref(''),confirm=ref(''),busy=ref(false),error=ref('')
function clear(){current.value='';password.value='';confirm.value='';error.value=''}
function open(){clear();dialog.value.showModal()}
function close(){if(busy.value)return;dialog.value.close();clear()}
async function change(){if(busy.value)return;if(password.value!==confirm.value){error.value='새 비밀번호 확인이 일치하지 않아요.';return}busy.value=true;error.value='';try{await api('/auth/password',{method:'POST',body:{currentPassword:current.value,newPassword:password.value,confirmPassword:confirm.value}});dialog.value.close();clear();s.clearSession();await router.replace('/account?password=changed')}catch(e){error.value=e.message}finally{busy.value=false}}
onUnmounted(()=>{dialog.value?.close();clear()})
</script>
<template><button class="light password-change-launch" @click="open">비밀번호 재설정</button><dialog ref="dialog" class="ticket-dialog" aria-label="비밀번호 재설정" @cancel.prevent="close"><button class="text-button ticket-close" aria-label="비밀번호 창 닫기" :disabled="busy" @click="close">✕</button><h2>비밀번호 재설정</h2><p>현재 비밀번호 확인 후 변경할 수 있어요. 변경하면 모든 기기에서 로그아웃됩니다.</p><form class="password-change-form" @submit.prevent="change"><fieldset :disabled="busy"><label>현재 비밀번호<input v-model="current" type="password" autocomplete="current-password" required maxlength="128"/></label><label>새 비밀번호<input v-model="password" type="password" autocomplete="new-password" required minlength="8" maxlength="128" placeholder="8~128자"/></label><label>새 비밀번호 확인<input v-model="confirm" type="password" autocomplete="new-password" required minlength="8" maxlength="128"/></label><p v-if="error" role="alert">{{error}}</p><button :disabled="busy||!current||password.length<8||!confirm">{{busy?'변경 중…':'비밀번호 변경하고 다시 로그인'}}</button></fieldset></form></dialog></template>
<style scoped>
.password-change-launch{font-size:12px}.password-change-form fieldset{padding:0;border:0;min-width:0}.password-change-form label{display:flex;flex-direction:column;gap:8px;margin:16px 0;font-size:12px}.password-change-form input{box-sizing:border-box;width:100%;min-width:0}.password-change-form button{width:100%;margin:8px 0}@media(max-width:600px){.password-change-form input{font-size:16px}}
</style>
