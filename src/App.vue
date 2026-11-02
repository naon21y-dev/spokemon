<script setup>
import {useArcade} from './stores/arcade'
import {partnerTheme} from './data/evolutions'
import {ref,watch,onMounted,onUnmounted} from 'vue'
import NewDungeonPopup from './components/NewDungeonPopup.vue'
import GiftCenter from './components/GiftCenter.vue'
import AttendancePopup from './components/AttendancePopup.vue'
import PageBoundary from './components/PageBoundary.vue'
import ActivityPopups from './components/ActivityPopups.vue'
import {useActivity} from './stores/activity'
import {useQuests} from './stores/quests'
import {useRoom} from './stores/room'
import MailArrivalPopup from './components/MailArrivalPopup.vue'
import QuestionComposer from './components/QuestionComposer.vue'
import {useMessages} from './stores/messages'
import {useLearning} from './stores/learning'
import PartnerImage from './components/PartnerImage.vue'
import {useRouter} from 'vue-router'
import {api} from './lib/api'
const router=useRouter(),sidebarOpen=ref(false),logoutDialog=ref(null),logoutBusy=ref(false),logoutError=ref('');let presenceTimer
watch(()=>router.currentRoute.value.fullPath,()=>sidebarOpen.value=false)
function sidebarKey(event){if(event.key==='Escape')sidebarOpen.value=false}
function presence(){if(s.user?.role==='student')api('/presence',{method:'POST',body:{active:document.visibilityState==='visible'}}).catch(()=>{})}
async function confirmLogout(){if(logoutBusy.value)return;logoutBusy.value=true;logoutError.value='';try{await s.logout();logoutDialog.value?.close();await router.replace('/account')}catch(e){logoutError.value=e.message}finally{logoutBusy.value=false}}
const s=useArcade(),learning=useLearning(),messages=useMessages(),activity=useActivity(),quests=useQuests();let mailTimer
function updateMail(){presence();if(s.user&&document.visibilityState==='visible'){messages.refresh();activity.refresh();quests.refresh()}}
watch(()=>[s.user?.role,s.partner.id,s.partner.stage],()=>{document.documentElement.dataset.partner=s.user?.role==='student'?partnerTheme(s.partner):'system'},{immediate:true})
watch(()=>!!s.user,value=>document.documentElement.classList.toggle('auth-mode',!value),{immediate:true})
watch(()=>s.user?.id,()=>{learning.reset();messages.reset();activity.reset();quests.reset();useRoom().reset();clearInterval(mailTimer);if(s.user){updateMail();mailTimer=setInterval(updateMail,15000)}})
onMounted(()=>{document.addEventListener('keydown',sidebarKey);presence();presenceTimer=setInterval(presence,30000);if(s.user){updateMail();mailTimer=setInterval(updateMail,15000)}document.addEventListener('visibilitychange',updateMail);window.addEventListener('spokemon-points-refresh',updateMail)})
onUnmounted(()=>{document.removeEventListener('keydown',sidebarKey);clearInterval(presenceTimer);clearInterval(mailTimer);document.removeEventListener('visibilitychange',updateMail);window.removeEventListener('spokemon-points-refresh',updateMail)})
</script>
<template><NewDungeonPopup/><AttendancePopup/><ActivityPopups/><MailArrivalPopup/><div :class="['shell',{'auth-shell':!s.user}]"><header v-if="s.user"><RouterLink class="brand brand-logo" :to="s.user?.role==='admin'?'/admin':'/home'" :aria-label="s.user?.role==='admin'?'Spokemon 관리자 페이지로':'Spokemon 메인으로'"><img class="site-logo" src="/images/pokemon-logo.png" alt="Spokemon" width="1869" height="854" fetchpriority="high"/><span class="brand-title">Spokemon</span></RouterLink><div class="wallet"><template v-if="s.user.role==='student'"><RouterLink to="/pet" class="partner-wallet"><PartnerImage size="tiny"/> Lv.{{s.level}}</RouterLink><RouterLink to="/quests" class="profile-link quest-wallet">📖 퀘스트<i v-if="quests.ready" class="quest-ready-light" :aria-label="'수령할 퀘스트 '+quests.ready+'개'"/></RouterLink><span>🪙 <b>{{s.data.coins.toLocaleString()}}</b></span></template><button v-if="s.user.role==='admin'" class="profile-link admin-logout" @click="logoutDialog.showModal()">{{s.user.nickname}}님 ⏻</button><RouterLink v-else to="/account" class="profile-link">{{s.user.nickname}}님 ⚙</RouterLink></div></header>
 <div v-if="s.user" class="navigation-row"><button v-if="s.user.role==='student'" class="menu-toggle" :aria-expanded="sidebarOpen" aria-controls="student-navigation" @click="sidebarOpen=!sidebarOpen">☰ 메뉴</button><nav v-else><RouterLink to="/admin">관리자 페이지</RouterLink><RouterLink to="/workshop">공유 문제 관리</RouterLink></nav><div class="question-toolbar"><RouterLink to="/sloud" class="button sloud-shortcut">Sloud</RouterLink><template v-if="s.user.role==='student'"><GiftCenter/><QuestionComposer/></template></div></div>
 <template v-if="s.user?.role==='student'&&sidebarOpen"><div class="student-sidebar-shade" @click="sidebarOpen=false"></div><aside id="student-navigation" class="student-sidebar" aria-label="사용자 메뉴" @keydown.esc="sidebarOpen=false"><div class="sidebar-title"><b>모험 메뉴</b><button aria-label="메뉴 닫기" @click="sidebarOpen=false">✕</button></div><nav><RouterLink to="/student">▥ 내 학습</RouterLink><RouterLink to="/workshop">✎ 문제 제작소</RouterLink><RouterLink to="/cards">▣ 카드 뒤집기</RouterLink><RouterLink to="/hidden">⌕ 숨은그림 찾기</RouterLink><RouterLink to="/python-dungeon">⚔ 코딩 던전</RouterLink><RouterLink to="/quiz">✦ 퀴즈 타임</RouterLink><RouterLink to="/pet">♥ 마이 리틀 펫</RouterLink><RouterLink to="/collection">◉ 포켓몬 도감</RouterLink><RouterLink to="/pet/mailbox">✉ 내 쪽지함 <b v-if="messages.unread">{{messages.unread}}</b></RouterLink></nav></aside></template><p v-if="s.storageError" class="notice" role="alert">{{s.storageError}}</p><main><PageBoundary><RouterView :key="s.user?.id||'guest'" /></PageBoundary></main><footer v-if="s.user"><span>✦ Spokemon</span><span>작은 휴식, 즐거운 한 판 · 서버에 안전하게 저장됩니다</span></footer><dialog ref="logoutDialog" class="logout-dialog" aria-label="로그아웃 확인"><h2>로그아웃 하시겠습니까?</h2><p v-if="logoutError" role="alert">{{logoutError}}</p><div class="toolbar"><button class="light" :disabled="logoutBusy" @click="logoutDialog.close()">취소</button><button :disabled="logoutBusy" @click="confirmLogout">{{logoutBusy?'로그아웃 중…':'로그아웃'}}</button></div></dialog></div></template>

<style scoped>
.quest-wallet{position:relative}.quest-ready-light{position:absolute;top:-5px;right:-5px;display:block;width:13px;height:13px;border-radius:50%;background:#ff263f;border:2px solid white;box-shadow:0 0 0 1px #a50925,0 0 9px #ff263faa;pointer-events:none}
</style>

<style scoped>
 .navigation-row{justify-content:space-between}.question-toolbar{margin-left:auto;display:flex;align-items:center;gap:10px;flex-wrap:wrap}.wallet{display:flex;align-items:center;gap:8px}.student-sidebar-shade{position:fixed;inset:0;background:#13263d80;z-index:90}.student-sidebar{position:fixed;left:0;top:0;bottom:0;z-index:91;width:min(310px,86vw);padding:24px 18px;background:var(--rpg-paper,#fff);border-right:4px solid var(--rpg-edge);box-shadow:8px 0 24px #14273a40;overflow:auto;box-sizing:border-box}.sidebar-title{display:flex;align-items:center;justify-content:space-between;margin-bottom:22px}.student-sidebar nav{display:flex;flex-direction:column;gap:12px}.student-sidebar nav a{display:block;padding:13px 16px;width:100%;box-sizing:border-box}.student-sidebar nav a.router-link-active{background:var(--rpg-soft);color:var(--rpg-ink)}.sidebar-title button{padding:8px;min-width:40px}.menu-toggle{min-width:100px}@media(max-width:650px){.wallet{gap:5px;justify-content:flex-end;flex-wrap:wrap}.wallet>*{font-size:11px!important;padding:8px!important}.question-toolbar{gap:6px}.question-toolbar :deep(button),.question-toolbar>a{font-size:10px!important;padding:8px!important}.navigation-row{gap:8px;align-items:flex-start}.menu-toggle{min-width:0;font-size:11px;padding:9px}}
 </style>
<style scoped>.question-toolbar>a,.question-toolbar :deep(.gift-center-launch),.question-toolbar :deep(.question-launch){box-sizing:border-box!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;height:42px!important;min-height:42px!important;line-height:1.2!important;padding:8px 13px!important;font-size:12px!important;margin:0!important}@media(max-width:600px){.question-toolbar>a,.question-toolbar :deep(.gift-center-launch),.question-toolbar :deep(.question-launch){height:36px!important;min-height:36px!important;padding:6px 9px!important;font-size:10px!important}}</style>