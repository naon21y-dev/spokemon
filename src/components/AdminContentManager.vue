<script setup>
import {ref,onMounted,computed} from 'vue'
import {api} from '../lib/api'
import {syncCurriculum} from '../data/quiz'
import ManualProblemEditor from './ManualProblemEditor.vue'
const emit=defineEmits(['updated']),catalog=ref([]),subject=ref('vue'),subjectName=ref(''),unitName=ref(''),error=ref(''),notice=ref(''),busy=ref(false),editing=ref(null),editor=ref(false),posts=ref([]),editorKey=ref(0)
const units=computed(()=>catalog.value.find(s=>s.id===subject.value)?.units??[])
async function load(){catalog.value=await api('/curriculum');syncCurriculum(catalog.value);posts.value=(await api('/workshop')).items.filter(p=>p.source==='official')}
async function add(kind){if(busy.value)return;busy.value=true;error.value='';try{const result=await api('/admin/curriculum',{method:'POST',body:{kind,name:kind==='subject'?subjectName.value:unitName.value,subject:subject.value}});await load();if(kind==='subject')subject.value=result.id;subjectName.value='';unitName.value='';notice.value='등록했어요. 새 단원은 기수별 진도 공개 후 학습할 수 있습니다.';emit('updated')}catch(e){error.value=e.message}finally{busy.value=false}}
function create(){editing.value=null;editorKey.value++;editor.value=true}
async function edit(id){error.value='';try{editing.value=await api('/workshop/'+id+'/edit');editorKey.value++;editor.value=true}catch(e){error.value=e.message}}
async function saved(){editor.value=false;notice.value='공식 문제를 저장했어요.';await load();emit('updated')}
onMounted(()=>load().catch(e=>error.value=e.message))
</script>
<template><section class="panel admin-content"><div class="mailbox-heading"><h2>과목·단원 / 공식 문제 관리</h2><button @click="create">＋ 공식 문제 추가</button></div><p>등록한 과목·단원은 학생 문제 제작 드롭다운과 기수별 진도 공개에 함께 표시됩니다.</p><p v-if="error" class="notice" role="alert">{{error}}</p><p v-if="notice" class="notice" role="status">{{notice}}</p><div class="content-settings"><form @submit.prevent="add('subject')"><label>새 과목 이름<input v-model="subjectName" maxlength="100" required placeholder="예: Java"/></label><button :disabled="busy">과목 추가</button></form><form @submit.prevent="add('unit')"><label>과목<select v-model="subject"><option v-for="s in catalog" :key="s.id" :value="s.id">{{s.name}}</option></select></label><label>새 단원 이름<input v-model="unitName" maxlength="100" required placeholder="예: 객체와 클래스"/></label><button :disabled="busy">단원 추가</button></form></div><p>{{units.map(u=>u.title).join(' / ')||'단원을 추가하세요.'}}</p><ManualProblemEditor v-if="editor" :key="editorKey" :initial="editing" :admin="true" :catalog="catalog" @saved="saved" @cancel="editor=false"/><details v-else><summary>추가한 공식 문제 {{posts.length}}개</summary><article v-for="p in posts" :key="p.id" class="content-post"><span><b>{{p.title}}</b> · {{p.published?'공개 중':'비공개'}}</span><button class="light" @click="edit(p.id)">공식 문제 수정</button></article></details></section></template>
