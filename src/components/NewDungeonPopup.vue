<script setup>
import {isNoticeHidden,hideNoticeToday} from '../lib/newGameNotice'
import {ref,onMounted,onUnmounted,watch} from 'vue'
import {useArcade} from '../stores/arcade'
import {useActivity} from '../stores/activity'
import {useMessages} from '../stores/messages'
import {useRouter} from 'vue-router'
const s=useArcade(),activity=useActivity(),messages=useMessages(),router=useRouter(),dialog=ref(null),hideToday=ref(false);let pending='',after=0,timer
function hidden(){try{return isNoticeHidden(localStorage,s.user.id)}catch{return false}}
function login(e){if(s.user?.role!=='student'||e.detail?.userId!==s.user.id)return;pending=s.user.id;hideToday.value=false;after=Date.now()+1800}
function tick(){if(!pending||pending!==s.user?.id||s.user.role!=='student'||document.hidden||Date.now()<after)return;if(hidden()){pending='';return}if(document.querySelector('dialog[open],.mail-alert-popup')||activity.queue.length||messages.notification)return;pending='';dialog.value.showModal()}
function close(){if(hideToday.value&&s.user)try{hideNoticeToday(localStorage,s.user.id)}catch{};dialog.value.close()}
async function play(){close();await router.push('/python-dungeon')}
watch(()=>s.user?.id,()=>{pending='';dialog.value?.close()})
onMounted(()=>{window.addEventListener('spokemon-login-success',login);timer=setInterval(tick,400)});onUnmounted(()=>{window.removeEventListener('spokemon-login-success',login);clearInterval(timer);dialog.value?.close()})
</script>
<template><dialog ref="dialog" class="new-dungeon-popup" aria-label="신규 게임 안내" @cancel.prevent="close"><span class="new-dungeon-chip">NEW!</span><img src="/images/dungeon/title.svg" alt="새로운 픽셀 코딩 던전"/><h2>🎮 새로운 게임이 등록되었어요!!</h2><p>Python 코딩 던전 탈출에 도전하고 최대 200P를 획득해 보세요!</p><div class="toolbar"><button @click="play">게임 시작하기</button><button class="light" @click="close">닫기</button></div><label><input v-model="hideToday" type="checkbox"/>오늘 하루 보지 않기</label></dialog></template>
<style scoped>
.new-dungeon-popup{box-sizing:border-box;width:min(520px,calc(100vw - 28px));max-height:88dvh;overflow:auto;padding:24px;background:#172f3c;color:#f5e8bc;border:3px solid #dfc47a;border-radius:3px;text-align:center;box-shadow:0 7px #0b202c}.new-dungeon-popup::backdrop{background:#102537c9}.new-dungeon-popup>img{width:100%;height:170px;object-fit:cover;image-rendering:pixelated;border:2px solid #728775;margin:10px 0}.new-dungeon-popup h2{font-size:19px;line-height:1.7;color:#ffe5a2}.new-dungeon-popup p{font-size:13px;line-height:1.9;color:#f5e8bc}.new-dungeon-chip{background:#e4c777;color:#192f3d;padding:4px 12px;font-size:12px;display:inline-block}.new-dungeon-popup .toolbar{justify-content:center;gap:10px;flex-wrap:wrap}.new-dungeon-popup label{display:flex;align-items:center;justify-content:center;gap:9px;margin-top:20px;font-size:12px}.new-dungeon-popup input{width:18px;height:18px;accent-color:#bda461}.new-dungeon-popup button{background:#315b49!important;background-image:none!important;color:#fce7ad!important;border:2px solid #c3b276!important;border-radius:2px;padding:10px 16px;margin:0;box-shadow:0 3px #0b1c26!important;font-size:12px}@media(max-width:600px){.new-dungeon-popup{padding:18px 14px}.new-dungeon-popup h2{font-size:16px}.new-dungeon-popup p{font-size:12px}.new-dungeon-popup>img{height:140px}}
</style>
