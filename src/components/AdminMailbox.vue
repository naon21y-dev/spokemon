<script setup>
import FilePicker from "./FilePicker.vue"
import AttachmentList from "./AttachmentList.vue"

import {ref,onMounted,onUnmounted,watch} from 'vue'
const attachments=ref([]),attachmentBusy=ref(false);
import {api} from '../lib/api'
import {useMessages} from '../stores/messages'
defineProps({classes:{type:Array,default:()=>[]}})
const messages=useMessages(),search=ref(''),classId=ref(''),status=ref(''),items=ref([]),selected=ref(null),reply=ref(''),loading=ref(false),sending=ref(false),error=ref(''),success=ref('');let requestKey=crypto.randomUUID(),interval,alive=true,detailRequest=0
watch(reply,()=>{if(!sending.value)requestKey=crypto.randomUUID()},{flush:'sync'})
async function load(){if(loading.value)return;loading.value=true;try{const result=await api('/admin/messages?'+new URLSearchParams({search:search.value,classId:classId.value,status:status.value}));if(alive){items.value=result.items;messages.pending=result.pending}}catch(e){if(alive)error.value=e.message}finally{if(alive)loading.value=false}}
async function open(id){const current=++detailRequest;error.value='';success.value='';try{const item=await api('/admin/messages/'+id);if(alive&&current===detailRequest){selected.value=item;reply.value='';attachments.value=[];requestKey=crypto.randomUUID()}}catch(e){if(alive)error.value=e.message}}
async function send(){if(sending.value||!selected.value||!reply.value.trim())return;sending.value=true;error.value='';success.value='';const id=selected.value.id;try{await api('/admin/messages/'+id+'/reply',{method:'POST',body:{content:reply.value,requestKey}});success.value='학생에게 답장을 보냈어요.';reply.value='';attachments.value=[];requestKey=crypto.randomUUID();selected.value=await api('/admin/messages/'+id);await load();await messages.refresh()}catch(e){error.value=e.message}finally{sending.value=false}}
const composing=ref(false),recipients=ref([]),recipientSearch=ref(''),recipientIds=ref([]),recipientLoading=ref(false),newTitle=ref(''),newContent=ref('');let composeKey=crypto.randomUUID()
let recipientRequest=0
async function findRecipients(){
 const request=++recipientRequest
 recipientLoading.value=true
 try{
  const result=await api('/admin/message-recipients?'+new URLSearchParams({search:recipientSearch.value}))
  if(alive&&request===recipientRequest)recipients.value=result.items
 }catch(e){if(alive&&request===recipientRequest){recipients.value=[];error.value=e.message}}
 finally{if(request===recipientRequest)recipientLoading.value=false}
}
async function compose(){detailRequest++;composing.value=true;selected.value=null;attachments.value=[];await findRecipients()}
function selectAll(){
 recipientIds.value=[...new Set([...recipientIds.value,...recipients.value.map(student=>student.id)])]
}
watch([recipientIds,newTitle,newContent,attachments],()=>{if(!sending.value)composeKey=crypto.randomUUID()},{flush:'sync'})
async function sendNew(){
 if(sending.value||attachmentBusy.value||!recipientIds.value.length||!newTitle.value.trim()||!newContent.value.trim())return
 sending.value=true;error.value='';success.value=''
 try{
  const result=await api('/admin/messages',{method:'POST',body:{
   studentIds:recipientIds.value,title:newTitle.value,content:newContent.value,
   attachmentIds:attachments.value.map(f=>f.id),requestKey:composeKey
  }})
  composing.value=false;recipientIds.value=[];newTitle.value='';newContent.value='';attachments.value=[]
  composeKey=crypto.randomUUID()
  success.value='학생 '+result.count+'명에게 쪽지를 보냈어요.'
  await load();await messages.refresh()
 }catch(e){error.value=e.message}finally{sending.value=false}
}
async function remove(id){if(sending.value||!window.confirm('내 쪽지함에서 삭제할까요? 상대방의 쪽지는 유지됩니다.'))return;sending.value=true;try{await api('/admin/messages/'+id,{method:'DELETE'});if(selected.value?.id===id)selected.value=null;success.value='내 쪽지함에서 삭제했어요.';await load();await messages.refresh()}catch(e){error.value=e.message}finally{sending.value=false}}
async function clearAll(){if(sending.value||!window.confirm('검색 조건과 관계없이 내 학생 쪽지함을 모두 삭제할까요? 학생들의 쪽지는 유지됩니다.'))return;sending.value=true;error.value='';try{await api('/admin/messages',{method:'DELETE',body:{confirmed:true}});detailRequest++;selected.value=null;success.value='내 학생 쪽지함을 모두 삭제했어요.';await load();await messages.refresh()}catch(e){error.value=e.message}finally{sending.value=false}}
function poll(){if(document.visibilityState==='visible')load()}
onMounted(()=>{load();interval=setInterval(poll,15000);document.addEventListener('visibilitychange',poll)})
onUnmounted(()=>{alive=false;detailRequest++;clearInterval(interval);document.removeEventListener('visibilitychange',poll)})
</script>
<template><section class="panel study-history admin-mailbox"><div class="mailbox-heading"><h2>학생 쪽지함</h2><b class="mail-count">답변 대기 {{messages.pending}}개</b><button class="light mail-clear-all" :disabled="sending||attachmentBusy||loading" @click="clearAll">학생 쪽지 전체 삭제</button></div><p>학생과 관리자만 확인하는 비공개 쪽지입니다.</p><button v-if="!composing" class="light" :disabled="sending||attachmentBusy" @click="compose">＋ 학생에게 쪽지 쓰기</button><form v-if="composing" class="admin-compose" @submit.prevent="sendNew"><h3>학생에게 새 쪽지</h3><label>받는 학생 검색<input v-model="recipientSearch" maxlength="100" :disabled="sending" @input="findRecipients" placeholder="이름 또는 아이디"/></label><fieldset class="recipient-picker" :disabled="sending">
 <legend>받는 학생 · {{recipientIds.length}}명 선택</legend>
 <div class="toolbar">
  <button type="button" class="light" :disabled="recipientLoading||!recipients.length" @click="selectAll">{{recipientSearch.trim()?'검색 결과 전체 선택':'전체 선택'}}</button>
  <button type="button" class="light" :disabled="!recipientIds.length" @click="recipientIds=[]">전체 해제</button>
 </div>
 <p v-if="recipientLoading" role="status">학생을 불러오는 중…</p>
 <p v-else-if="!recipients.length">표시할 학생이 없어요.</p>
 <div v-else class="recipient-list">
  <label v-for="student in recipients" :key="student.id">
   <input v-model="recipientIds" type="checkbox" :value="student.id"/>
   <span>{{student.name}} · {{student.login}} · {{student.class_name??'미배정'}}</span>
  </label>
 </div>
</fieldset><label>제목<input v-model="newTitle" required maxlength="100"/></label><label>내용<textarea v-model="newContent" required maxlength="5000" rows="4"/></label><FilePicker v-model="attachments" images-only :disabled="sending" @busy="attachmentBusy=$event"/><div class="toolbar"><button :disabled="sending||attachmentBusy||!recipientIds.length||!newTitle.trim()||!newContent.trim()">{{sending?'전송 중…':recipientIds.length+'명에게 보내기'}}</button><button type="button" class="light"  :disabled="sending" @click="composing=false">닫기</button></div></form><form class="mail-filters" @submit.prevent="load"><label>학생명·아이디<input v-model="search" maxlength="100" placeholder="학생 검색"/></label><label>기수<select v-model="classId"><option value="">전체 기수</option><option v-for="c in classes" :key="c.id" :value="c.id">{{c.name}}</option></select></label><label>답변 상태<select v-model="status"><option value="">전체 상태</option><option value="pending">답변 대기</option><option value="answered">답변 완료</option></select></label><button :disabled="loading">{{loading?'불러오는 중…':'쪽지 검색'}}</button></form><p v-if="error" class="account-error" role="alert">{{error}}</p><p v-if="success" class="mail-success" role="status">{{success}}</p><p v-if="!items.length&&!loading">조건에 맞는 쪽지가 없어요.</p><div v-for="m in items" :key="m.id" class="mail-list-item"><div class="mail-meta"><b>{{m.student_name}} · {{m.class_name}}</b><span class="review-badge">{{m.status==='answered'?'답변 완료':'답변 대기'}}</span></div><button class="mail-subject-link" :disabled="sending||composing" @click="open(m.id)">{{m.title}} →</button><button class="text-button mail-delete" :disabled="sending" @click="remove(m.id)">삭제</button><time>{{new Date(m.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}}</time></div><section v-if="selected" class="mail-admin-detail"><button class="text-button" :disabled="sending" @click="selected=null">쪽지 상세 닫기</button><button class="text-button mail-delete" :disabled="sending" @click="remove(selected.id)">쪽지 삭제</button><h3>{{selected.title}}</h3><AttachmentList kind="private" :resource="selected.id" :refresh-key="selected.replies.length"/><p>{{selected.studentName}} ({{selected.className}})</p><p v-if="!selected.fromAdmin" class="mail-body">{{selected.body}}</p><article v-for="r in selected.replies" :key="r.id" class="mail-reply"><p><b>{{r.admin_name}}<small v-if="r.admin_name!==(r.senderRole==='student'?'학생':'관리자')"> · {{r.senderRole==='student'?'학생':'관리자'}}</small></b> · {{r.read_at?'학생 읽음':'학생 읽지 않음'}} · {{new Date(r.created_at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}}</p><p class="mail-body">{{r.body}}</p></article><form @submit.prevent="send"><label for="admin-mail-reply">학생에게 답장</label><textarea id="admin-mail-reply" v-model="reply" :disabled="sending" required maxlength="5000" rows="6" placeholder="학생에게 보낼 답장을 적어 주세요."/><FilePicker v-model="attachments" images-only :disabled="sending" @busy="attachmentBusy=$event"/><button :disabled="sending||attachmentBusy||!reply.trim()">{{sending?'답장 전송 중…':'답장 전송'}}</button></form></section></section></template>

<style scoped>
.recipient-picker{min-width:0;border:1px solid var(--rpg-mid);margin:0;padding:10px}
.recipient-picker .toolbar{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 8px}
.recipient-list{max-height:240px;overflow:auto;display:grid;gap:4px}
.recipient-list label{display:flex;flex-direction:row;align-items:center;gap:8px;padding:5px 0;overflow-wrap:anywhere}
.recipient-list input[type=checkbox]{width:auto;min-width:auto;margin:0;flex:none}
</style>
