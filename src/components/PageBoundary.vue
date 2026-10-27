<script setup>
import {ref,computed,watch,onErrorCaptured,onMounted,onUnmounted} from 'vue'
import {useRouter} from 'vue-router'
import {useArcade} from '../stores/arcade'
import {pageNetwork,clearPageFailure} from '../lib/pageNetwork'
const router=useRouter(),s=useArcade(),runtimeError=ref(false),slow=ref(false),revision=ref(0),retrying=ref(false),failed=computed(()=>runtimeError.value||!!pageNetwork.failure);let timer
watch(()=>pageNetwork.pending,n=>{clearTimeout(timer);if(n>0)timer=setTimeout(()=>slow.value=true,300);else slow.value=false},{immediate:true})
onErrorCaptured(()=>{runtimeError.value=true;return false})
function onError(event){if(event.error)runtimeError.value=true}
function onOffline(){pageNetwork.failure='인터넷 연결이 끊겼어요. 연결 상태를 확인하고 다시 시도하세요.'}
async function retry(){if(retrying.value)return;retrying.value=true;clearPageFailure();try{try{await s.refresh()}catch(e){if(e.status!==401)throw e}runtimeError.value=false;revision.value++;if(s.user?.role==='admin')await router.replace('/admin')}catch{pageNetwork.failure='아직 서버에 연결할 수 없어요. 잠시 후 다시 시도하세요.'}finally{retrying.value=false}}
function reload(){window.location.reload()}
const stop=router.onError(()=>runtimeError.value=true)
onMounted(()=>{window.addEventListener('error',onError);window.addEventListener('offline',onOffline)})
onUnmounted(()=>{clearTimeout(timer);stop();window.removeEventListener('error',onError);window.removeEventListener('offline',onOffline)})
</script>
<template><div class="page-boundary"><div v-if="!runtimeError" :key="revision" class="page-boundary-content"><slot/></div><section v-if="failed||retrying||slow" class="page-state-overlay" :role="failed?'alert':'status'" aria-live="polite" :aria-busy="!failed||retrying"><div class="page-state-console"><div class="page-state-leds" aria-hidden="true"><i></i><i></i><i></i></div><div class="page-state-screen"><img src="/images/pokemon-logo.png" alt="Spokemon"/><div class="page-state-ball" :class="{paused:failed&&!retrying}" aria-hidden="true"></div><h1>{{retrying?'다시 연결 중…':failed?'잠시 연결이 끊겼어요':'불러오는 중…'}}</h1><p>{{retrying?'조금만 기다려 주세요.':failed?(runtimeError?'화면을 표시하지 못했어요. 다시 시도해 주세요.':pageNetwork.failure):'다음 모험을 준비하고 있어요.'}}</p><div v-if="failed&&!retrying" class="toolbar"><button @click="retry">다시 시도</button><button class="light" @click="reload">새로고침</button></div><div v-else class="page-loading-dots" aria-hidden="true"><i></i><i></i><i></i></div></div><div class="page-state-speaker" aria-hidden="true">▰ ▰ ▰</div></div></section></div></template>
