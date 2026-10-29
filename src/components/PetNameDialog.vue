<script setup>
import {onMounted,ref} from 'vue'
import {useArcade} from '../stores/arcade'
const emit=defineEmits(['close']),s=useArcade(),dialog=ref(null),name=ref(s.data.pet.nickname??''),busy=ref(false),error=ref('')
onMounted(()=>dialog.value.showModal())
function close(){if(!busy.value){dialog.value.close();emit('close')}}
async function save(){if(busy.value)return;busy.value=true;error.value='';try{await s.petAction('name',name.value);busy.value=false;close()}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><dialog ref="dialog" class="pet-name-dialog" aria-labelledby="pet-name-title" @cancel.prevent="close"><h2 id="pet-name-title">파트너 이름 정하기</h2><p>포켓몬의 별명을 정해 주세요. 강화하거나 캐릭터를 바꾸어도 유지됩니다.</p><form @submit.prevent="save"><label for="pet-custom-name">포켓몬 이름</label><input id="pet-custom-name" v-model="name" required maxlength="24" :placeholder="s.partner.name" autocomplete="off"/><small>공백 정리 후 1~12글자 · 계정 닉네임과 별도로 저장됩니다.</small><p v-if="error" role="alert">{{error}}</p><div><button type="submit" :disabled="busy">{{busy?'저장 중…':'이름 저장'}}</button><button type="button" class="light" :disabled="busy" @click="close">취소</button></div></form></dialog></template>
<style scoped>
.pet-name-dialog{box-sizing:border-box;width:min(430px,calc(100vw - 24px));max-height:90dvh;padding:24px;background:var(--rpg-paper);color:var(--rpg-ink);border:3px solid var(--rpg-edge);border-radius:14px;box-shadow:0 6px 0 var(--rpg-shadow)}.pet-name-dialog::backdrop{background:#172638b5;backdrop-filter:blur(3px)}.pet-name-dialog h2{font-size:22px}.pet-name-dialog p,.pet-name-dialog label{font-size:12px;line-height:1.8}.pet-name-dialog form{display:flex;flex-direction:column;gap:10px}.pet-name-dialog input{width:100%;box-sizing:border-box}.pet-name-dialog small{font-size:10px}.pet-name-dialog form>div{display:flex;gap:10px;margin-top:10px}
</style>
