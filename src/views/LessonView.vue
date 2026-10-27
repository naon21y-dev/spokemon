<script setup>
import {ref,watch} from 'vue'
import {useRoute,useRouter} from 'vue-router'
import {api} from '../lib/api'
import {useLearning} from '../stores/learning'
import {useStudyActivity} from '../composables/useStudyActivity'
import GameHeader from '../components/GameHeader.vue'
const route=useRoute(),router=useRouter(),study=useLearning(),lesson=ref(null),error=ref('')
useStudyActivity(()=>lesson.value?{kind:'lesson',subject:route.params.subject,unit:Number(route.params.unit)}:null)
watch(()=>route.fullPath,async(_,previous,onCleanup)=>{const controller=new AbortController();onCleanup(()=>controller.abort());lesson.value=null;error.value='';try{lesson.value=await api('/lesson/'+route.params.subject+'/'+route.params.unit,{signal:controller.signal})}catch(e){if(e.name!=='AbortError')error.value=e.message}},{immediate:true})
async function complete(item){try{await api('/complete/'+item.id,{method:'POST'});item.completed=true}catch(e){error.value=e.message;lesson.value=null}}
async function quiz(){if(await study.startQuiz(route.params.subject,'all',Number(route.params.unit)))router.push('/quiz?resume=1');else error.value=study.error}
</script>
<template><GameHeader tag="LEARNING UNIT" :title="lesson?.title??'학습 단원'" description="개념을 읽고 학습 완료를 표시하거나 단원 퀴즈로 확인해요. 학습 완료 자체로는 포인트가 지급되지 않습니다."/><div v-if="error" class="panel"><h2>🔒 {{error}}</h2><RouterLink to="/student" class="button">내 학습으로</RouterLink></div><div v-else-if="lesson" class="panel"><div class="toolbar"><button @click="quiz">이 단원 퀴즈 풀기</button><RouterLink to="/student" class="button light">진도 목록으로</RouterLink></div><article v-for="item in lesson.items" :key="item.id" class="mistake-entry"><h3>{{item.title}}</h3><p>{{item.explanation}}</p><button :disabled="item.completed" @click="complete(item)">{{item.completed?'✓ 학습 완료':'학습 완료 표시'}}</button></article><a :href="lesson.source" target="_blank" rel="noopener">공식 학습 문서 ↗</a></div></template>
