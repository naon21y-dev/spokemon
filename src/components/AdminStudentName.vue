<script setup>
import {ref,watch} from 'vue'
import {api} from '../lib/api'
const props=defineProps({studentId:{type:String,required:true},value:{type:String,default:''}}),emit=defineEmits(['saved']),name=ref(props.value),busy=ref(false),error=ref(''),notice=ref('')
watch(()=>props.value,value=>{name.value=value})
async function save(){if(busy.value)return;busy.value=true;error.value='';notice.value='';try{const result=await api('/admin/students/'+props.studentId+'/private-name',{method:'PUT',body:{name:name.value}});name.value=result.privateName;emit('saved',result.privateName);notice.value='저장했어요'}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><form class="admin-private-name" @submit.prevent="save"><label>학생 이름 <small>관리자만 볼 수 있어요</small><input v-model="name" maxlength="40" placeholder="학생 이름 입력" :disabled="busy" @input="notice=''"/></label><button type="submit" class="light" :disabled="busy">{{busy?'저장 중…':'이름 저장'}}</button><small v-if="notice" role="status">{{notice}}</small><small v-if="error" role="alert">{{error}}</small></form></template>
<style scoped>
.admin-private-name{display:flex;align-items:end;gap:8px;flex-wrap:wrap;min-width:190px;max-width:100%}.admin-private-name label{display:flex;flex-direction:column;gap:5px;min-width:0;flex:1;font-size:12px}.admin-private-name label small{font-size:10px;opacity:.7}.admin-private-name input{box-sizing:border-box;width:100%;min-width:0;padding:9px;font-size:13px}.admin-private-name button{font-size:11px;padding:9px;white-space:nowrap}.admin-private-name>[role]{width:100%;font-size:11px}
</style>
