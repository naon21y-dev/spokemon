<script setup>
import {ref} from 'vue'
import {useArcade} from '../stores/arcade'
const arcade=useArcade(),name=ref(arcade.user?.nickname??''),busy=ref(false),error=ref(''),notice=ref('')
async function save(){if(busy.value)return;error.value='';notice.value='';const value=name.value.trim();if(value.length<2||value.length>20){error.value='이름은 2~20자로 입력해 주세요.';return}busy.value=true;try{await arcade.rename(value);name.value=arcade.user.nickname;notice.value='관리자 이름을 저장했어요.'}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><section class="panel admin-profile"><h2>관리자 이름 변경</h2><p>상단과 쪽지에 표시할 이름을 설정하세요.</p><form @submit.prevent="save"><label for="admin-display-name">표시 이름</label><input id="admin-display-name" v-model="name" required minlength="2" maxlength="20" autocomplete="nickname" :disabled="busy"/><button :disabled="busy||name.trim().length<2||name.trim()===arcade.user?.nickname">{{busy?'저장 중…':'이름 저장'}}</button><p v-if="notice" role="status">{{notice}}</p><p v-if="error" role="alert">{{error}}</p></form></section></template>
<style scoped>
.admin-profile{max-width:720px}.admin-profile form{display:grid;gap:12px;margin-top:20px}.admin-profile input{width:100%;min-width:0;box-sizing:border-box}.admin-profile button{justify-self:start}.admin-profile p{line-height:1.7}
</style>
