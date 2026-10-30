<script setup>
import {ref,onMounted,onUnmounted} from 'vue'
import {api} from '../lib/api'
import DressedPartner from './DressedPartner.vue'
const items=ref([]),loading=ref(false),error=ref('');let timer,alive=true
async function load(){if(loading.value||document.visibilityState==='hidden')return;loading.value=true;try{const result=await api('/admin/online');if(alive){items.value=result.items;error.value=''}}catch(e){if(alive)error.value=e.message}finally{if(alive)loading.value=false}}
onMounted(()=>{load();timer=setInterval(load,15000);document.addEventListener('visibilitychange',load)})
onUnmounted(()=>{alive=false;clearInterval(timer);document.removeEventListener('visibilitychange',load)})
</script>
<template><section class="panel admin-online" aria-label="현재 접속 중인 학생"><div class="online-title"><h2>🟢 현재 접속 중 <small>{{items.length}}명</small></h2><button class="light" :disabled="loading" @click="load">{{loading?'확인 중…':'새로고침'}}</button></div><p v-if="error" role="alert">{{error}}</p><p v-else-if="!items.length">{{loading?'접속 현황을 확인하고 있어요.':'현재 접속 중인 학생이 없어요.'}}</p><div v-else class="admin-online-list"><article v-for="person in items" :key="person.id"><DressedPartner size="online" :character="person.character" :stage="person.stage" :wear="person.wear"/><div><b>{{person.nickname}}</b><span>@{{person.login}}</span><small>{{person.className}}</small></div></article></div><small>15초마다 갱신 · 현재 화면을 보고 있는 학생 기준</small></section></template>
<style scoped>
.admin-online{margin:14px 0}.online-title{display:flex;align-items:center;justify-content:space-between;gap:12px}.online-title h2{margin:0;font-size:18px}.online-title h2 small{font-size:13px}.admin-online-list{display:grid;grid-template-columns:repeat(auto-fill,minmax(190px,1fr));gap:10px;max-height:270px;overflow-y:auto;margin:14px 0}.admin-online-list article{display:flex;align-items:center;gap:12px;padding:10px;background:var(--rpg-soft);border:1px solid var(--rpg-mid);border-radius:8px;min-width:0}.admin-online-list article>div{min-width:0;display:grid;gap:5px}.admin-online-list span,.admin-online-list b{overflow-wrap:anywhere}.admin-online>small{display:block;margin-top:10px}@media(max-width:500px){.admin-online-list{grid-template-columns:1fr}.online-title h2{font-size:15px}}
</style>
