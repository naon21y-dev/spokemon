<script setup>
import {nextTick,ref,onMounted,onUnmounted} from 'vue'
import {useRouter} from 'vue-router'
import {useMessages} from '../stores/messages'
import {useArcade} from '../stores/arcade'
const modalOpen=ref(false);let mailModalTimer;onMounted(()=>mailModalTimer=setInterval(()=>modalOpen.value=!!document.querySelector('dialog[open]'),250));onUnmounted(()=>clearInterval(mailModalTimer));
const messages=useMessages(),arcade=useArcade(),router=useRouter()
async function open(){const kind=messages.notification?.kind;messages.dismiss();if(arcade.user?.role==='admin'){await router.push({path:'/admin',query:{section:'mail'}});await nextTick();document.getElementById('admin-private-inbox')?.scrollIntoView({behavior:'smooth'})}else await router.push({path:'/pet/mailbox',query:{tab:kind==='friend'?'friends':'admin'}})}
</script>
<template><Transition name="mail-alert"><aside v-if="arcade.user&&messages.notification&&!modalOpen" class="mail-alert-popup" role="dialog" aria-label="새 쪽지 알림" aria-modal="false"><button class="mail-alert-close text-button" aria-label="새 쪽지 알림 닫기" @click="messages.dismiss">✕</button><div class="mail-alert-envelope" aria-hidden="true">✉</div><div><h2>쪽지가 도착했어요!</h2><p aria-live="polite">새 쪽지 {{messages.notification.count}}개를 확인해 보세요.</p><div class="toolbar"><button @click="open">쪽지함 열기</button><button class="light" @click="messages.dismiss">나중에</button></div></div></aside></Transition></template>
