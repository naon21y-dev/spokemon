<script setup>
import {ref,watch} from 'vue'
import {api} from '../lib/api'
const props=defineProps({kind:String,resource:String,refreshKey:{default:0}}),items=ref([]),error=ref('')
watch(()=>[props.kind,props.resource,props.refreshKey],async(_,old,cleanup)=>{const controller=new AbortController();cleanup(()=>controller.abort());items.value=[];error.value='';if(!props.resource)return;try{const result=await api('/attachments/'+props.kind+'/'+props.resource,{signal:controller.signal,background:true});if(!controller.signal.aborted)items.value=result.items}catch(e){if(e.name!=='AbortError')error.value=e.message}},{immediate:true})
</script>
<template><div v-if="items.length||error" class="attachment-list"><h3>첨부 파일</h3><p v-if="error" role="alert">{{error}}</p><figure v-for="file in items" :key="file.id"><a :href="file.url" target="_blank" rel="noopener"><img v-if="file.mime.startsWith('image/')" :src="file.url" :alt="file.name" loading="lazy"/><span>📎 {{file.name}} · {{Math.ceil(file.size/1024)}}KB ↗</span></a></figure></div></template>
<style scoped>.attachment-list{display:flex;flex-wrap:wrap;gap:12px;margin:15px 0;min-width:0}.attachment-list h3,.attachment-list p{width:100%;font-size:13px}.attachment-list figure{margin:0;max-width:100%;min-width:0}.attachment-list a{display:flex;flex-direction:column;gap:7px;overflow-wrap:anywhere;font-size:12px}.attachment-list img{max-width:100%;width:auto;max-height:260px;object-fit:contain;border-radius:7px;border:1px solid var(--rpg-mid)}</style>
