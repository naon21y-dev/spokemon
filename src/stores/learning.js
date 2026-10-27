import {defineStore} from 'pinia'
import {ref,computed} from 'vue'
import {api} from '../lib/api'
import {useArcade} from './arcade'
import {questionMap} from '../data/quiz'
export const useLearning=defineStore('learning',()=>{
 const arcade=useArcade(),state=ref({activeQuiz:null,activeReview:null,mistakes:{},history:[]}),catalog=ref([]),stats=ref({subjects:[]}),error=ref(''),busy=ref(false)
 const mistakes=computed(()=>Object.values(state.value.mistakes).sort((a,b)=>b.updatedAt-a.updatedAt)),pendingCount=computed(()=>mistakes.value.filter(m=>!m.reviewed&&!m.locked).length)
 function accept(session,review=false){state.value[review?'activeReview':'activeQuiz']=session;if(session?.question)questionMap[session.question.id]=session.question}
 async function load(){try{const [learning,units,summary]=await Promise.all([api('/learning'),api('/catalog'),api('/summary')]);state.value=learning;catalog.value=units;stats.value=summary;for(const g of [learning.activeQuiz,learning.activeReview])if(g?.question)questionMap[g.question.id]=g.question;error.value=''}catch(e){error.value=e.message}}
 async function action(fn){if(busy.value)return false;busy.value=true;error.value='';try{await fn();return true}catch(e){error.value=e.message;if(e.status===403){state.value.activeQuiz=null;state.value.activeReview=null;for(const id of Object.keys(questionMap))delete questionMap[id]}return false}finally{busy.value=false}}
 async function startQuiz(subject,type='all',unit){return action(async()=>accept(await api('/quiz/start',{method:'POST',body:{subject,type,...(unit?{unit}: {})}})))}
 async function startReview(ids){return action(async()=>accept(await api('/review/start',{method:'POST',body:{ids}}),true))}
 function session(review=false){return state.value[review?'activeReview':'activeQuiz']}
 function setDraft(value,review=false){const g=session(review);if(g&&!g.done&&!g.answers[g.questionIds[g.index]])g.draft=String(value)}
 async function submit(review=false){return action(async()=>{const g=session(review);if(!g)throw Error('퀴즈를 먼저 시작해 주세요.');const result=await api('/quiz/'+g.id+'/submit',{method:'POST',body:{questionId:g.questionIds[g.index],answer:g.draft}});accept(result.session,review);await Promise.all([arcade.refresh(),api('/summary').then(v=>stats.value=v)])})}
 async function next(review=false){return action(async()=>{const g=session(review);accept(await api('/quiz/'+g.id+'/next',{method:'POST'}),review);if(session(review).done)await load()})}
 async function retry(review=false){const g=session(review);if(!g)return false;return review?startReview(g.questionIds):startQuiz(g.subject,g.type)}
 async function saveDraft(review=false){const g=session(review);if(g&&!g.done)try{await api('/quiz/'+g.id+'/draft',{method:'PUT',body:{draft:g.draft}})}catch(e){error.value=e.message}}
 function reset(){state.value={activeQuiz:null,activeReview:null,mistakes:{},history:[]};catalog.value=[];stats.value={subjects:[]};for(const id of Object.keys(questionMap))delete questionMap[id]}
 return {state,catalog,stats,error,busy,mistakes,pendingCount,load,startQuiz,startReview,session,setDraft,saveDraft,submit,next,retry,reset}
})
