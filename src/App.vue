<script setup>
import {useArcade} from './stores/arcade'
import {ref,watch,onMounted,onUnmounted} from 'vue'
import AttendancePopup from './components/AttendancePopup.vue'
import PageBoundary from './components/PageBoundary.vue'
import ActivityPopups from './components/ActivityPopups.vue'
import {useActivity} from './stores/activity'
import {useQuests} from './stores/quests'
import MailArrivalPopup from './components/MailArrivalPopup.vue'
import QuestionComposer from './components/QuestionComposer.vue'
import {useMessages} from './stores/messages'
import {useLearning} from './stores/learning'
import PartnerImage from './components/PartnerImage.vue'
import {useRouter} from 'vue-router'
import {api} from './lib/api'
const router=useRouter(),logoutDialog=ref(null),logoutBusy=ref(false),logoutError=ref('');let presenceTimer
function presence(){if(s.user?.role==='student')api('/presence',{method:'POST',body:{active:document.visibilityState==='visible'}}).catch(()=>{})}
async function confirmLogout(){if(logoutBusy.value)return;logoutBusy.value=true;logoutError.value='';try{await s.logout();logoutDialog.value?.close();await router.replace('/account')}catch(e){logoutError.value=e.message}finally{logoutBusy.value=false}}
const s=useArcade(),learning=useLearning(),messages=useMessages(),activity=useActivity(),quests=useQuests();let mailTimer
function updateMail(){presence();if(s.user&&document.visibilityState==='visible'){messages.refresh();activity.refresh();quests.refresh()}}
watch(()=>[s.user?.role,s.partner.id],()=>{document.documentElement.dataset.partner=s.user?.role==='student'?s.partner.id:'system'},{immediate:true})
watch(()=>!!s.user,value=>document.documentElement.classList.toggle('auth-mode',!value),{immediate:true})
watch(()=>s.user?.id,()=>{learning.reset();messages.reset();activity.reset();quests.reset();clearInterval(mailTimer);if(s.user){updateMail();mailTimer=setInterval(updateMail,15000)}})
onMounted(()=>{presence();presenceTimer=setInterval(presence,30000);if(s.user){updateMail();mailTimer=setInterval(updateMail,15000)}document.addEventListener('visibilitychange',updateMail);window.addEventListener('spokemon-points-refresh',updateMail)})
onUnmounted(()=>{clearInterval(presenceTimer);clearInterval(mailTimer);document.removeEventListener('visibilitychange',updateMail);window.removeEventListener('spokemon-points-refresh',updateMail)})
</script>
<template><AttendancePopup/><ActivityPopups/><MailArrivalPopup/><div :class="['shell',{'auth-shell':!s.user}]"><header v-if="s.user"><RouterLink class="brand brand-logo" :to="s.user?.role==='admin'?'/admin':'/home'" :aria-label="s.user?.role==='admin'?'Spokemon 관리자 페이지로':'Spokemon 메인으로'"><img class="site-logo" src="/images/pokemon-logo.png" alt="Spokemon" width="1869" height="854" fetchpriority="high"/><span class="brand-title">Spokemon</span></RouterLink><div class="wallet"><template v-if="s.user"><span>🪙 <b>{{s.data.coins.toLocaleString()}}</b></span><RouterLink v-if="s.user.role==='student'" to="/quests" class="profile-link quest-wallet" :aria-label="quests.ready?'퀘스트 · 받을 수 있는 보상 '+quests.ready+'개':'퀘스트'">📖 퀘스트<i v-if="quests.ready" class="quest-ready-light" role="status" :aria-label="'완료한 퀘스트 '+quests.ready+'개 · 보상 받기'"/></RouterLink><RouterLink v-if="s.user.role==='student'" to="/pet" class="partner-wallet"><PartnerImage size="tiny"/> Lv.{{s.level}}</RouterLink></template><button v-if="s.user?.role==='admin'" class="profile-link admin-logout" @click="logoutDialog.showModal()">{{s.user.nickname}}님 ⏻</button><RouterLink v-else to="/account" class="profile-link">{{s.user?`${s.user.nickname}님 ⚙`:'로그인 / 회원가입'}}</RouterLink></div></header><div v-if="s.user" class="navigation-row"><nav><RouterLink v-if="s.user?.role==='admin'" to="/admin">관리자 페이지</RouterLink><RouterLink v-if="s.user?.role==='admin'" to="/workshop">공유 문제 관리</RouterLink><template v-else><RouterLink v-if="s.user?.role==='student'" to="/student">내 학습</RouterLink><RouterLink to="/workshop">문제 제작소</RouterLink><RouterLink to="/cards">카드 뒤집기</RouterLink><RouterLink to="/hidden">숨은그림 찾기</RouterLink><RouterLink to="/quiz">퀴즈 타임</RouterLink><RouterLink to="/pet">마이 리틀 펫 <b v-if="messages.unread" class="unread-badge">{{messages.unread}}</b></RouterLink></template></nav><div v-if="s.user?.role==='student'" class="question-toolbar"><QuestionComposer/></div></div><p v-if="s.storageError" class="notice" role="alert">{{s.storageError}}</p><main><PageBoundary><RouterView :key="s.user?.id||'guest'" /></PageBoundary></main><footer v-if="s.user"><span>✦ Spokemon</span><span>작은 휴식, 즐거운 한 판 · 서버에 안전하게 저장됩니다</span></footer><dialog ref="logoutDialog" class="logout-dialog" aria-label="로그아웃 확인"><h2>로그아웃 하시겠습니까?</h2><p v-if="logoutError" role="alert">{{logoutError}}</p><div class="toolbar"><button class="light" :disabled="logoutBusy" @click="logoutDialog.close()">취소</button><button :disabled="logoutBusy" @click="confirmLogout">{{logoutBusy?'로그아웃 중…':'로그아웃'}}</button></div></dialog></div></template>

<style scoped>
.quest-wallet{position:relative}.quest-ready-light{position:absolute;top:-5px;right:-5px;display:block;width:13px;height:13px;border-radius:50%;background:#ff263f;border:2px solid white;box-shadow:0 0 0 1px #a50925,0 0 9px #ff263faa;pointer-events:none}
</style>
