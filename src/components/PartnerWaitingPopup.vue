<script setup>
import {computed,ref,watch,nextTick,onUnmounted} from 'vue'
import {useArcade} from '../stores/arcade'
import PartnerImage from './PartnerImage.vue'

const s=useArcade(),dialog=ref(null)
const name=computed(()=>s.data.pet.nickname?.trim()||s.partner.name)
let retry
async function sync(){
  clearTimeout(retry)
  await nextTick()
  if(!s.partnerWaiting){dialog.value?.close();return}
  if(dialog.value?.open)return
  if(document.hidden||document.querySelector('dialog[open]')){
    retry=setTimeout(sync,500)
    return
  }
  dialog.value?.showModal()
}
function dismiss(){s.partnerWaiting=false}
watch(()=>s.partnerWaiting,sync,{immediate:true})
onUnmounted(()=>clearTimeout(retry))
</script>

<template>
  <dialog ref="dialog" class="partner-waiting" aria-labelledby="partner-waiting-title" @cancel.prevent="dismiss">
    <div class="waiting-rain" aria-hidden="true">☁</div>
    <PartnerImage/>
    <h2 id="partner-waiting-title">{{name}}이(가) 기다려요…</h2>
    <p>오랜만이에요. 파트너에게 인사해 볼까요?</p>
    <div class="waiting-actions">
      <RouterLink to="/pet" class="button" @click="dismiss">파트너 만나기</RouterLink>
      <button type="button" class="light" @click="dismiss">닫기</button>
    </div>
  </dialog>
</template>

<style scoped>
.partner-waiting{width:min(420px,calc(100vw - 28px));padding:24px;text-align:center;color:#f2f6fd;background:#303e56;border:2px solid #8b9bb1;border-radius:12px;box-shadow:0 8px 0 #1c2537}
.partner-waiting::backdrop{background:#121b2bd9}
.partner-waiting #partner-waiting-title{
 color:#ffffff!important;
 font-size:22px;
 line-height:1.65;
 margin:16px 0 12px;
 overflow-wrap:anywhere;
 text-shadow:none!important;
}
.partner-waiting>p{
 color:#e3eaf5!important;
 font-size:14px;
 line-height:1.8;
 margin:0 0 20px;
 opacity:1;
}
.partner-waiting .waiting-actions .button,
.partner-waiting .waiting-actions button{
 display:inline-flex;
 align-items:center;
 justify-content:center;
 min-height:44px;
 margin:0;
 padding:10px 16px;
 color:#192b44!important;
 background:#f1f6ff!important;
 border:2px solid #b9cbe3!important;
 box-shadow:0 3px 0 #101c30!important;
 text-shadow:none!important;
 font-size:14px;
}
.partner-waiting .waiting-actions .button{
 background:#b9dcff!important;
 border-color:#7cbaef!important;
}
.partner-waiting .waiting-actions :focus-visible{
 outline:3px solid #ffffff;
 outline-offset:4px;
}
@media(max-width:420px){
 .partner-waiting{padding:20px 16px}
 .partner-waiting #partner-waiting-title{font-size:19px}
}
.waiting-rain{font-size:36px;color:#b0bdd2}
.waiting-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap}
</style>
