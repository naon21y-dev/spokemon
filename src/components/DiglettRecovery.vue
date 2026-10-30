<script setup>
import {ref,computed} from 'vue'
import {useArcade} from '../stores/arcade'
import {findCharacter} from '../data/characters'
const s=useArcade(),confirm=ref(false),busy=ref(false),error=ref(''),original=computed(()=>findCharacter(s.data.pet.diglettRecovery?.character))
async function restore(){if(busy.value)return;busy.value=true;error.value='';try{await s.petAction('diglett-restore',s.data.pet.diglettRecovery.id)}catch(e){error.value=e.message}finally{busy.value=false}}
</script>
<template><section v-if="s.data.pet.character==='diglett'" class="panel diglett-recovery"><h2>강화 실패로 디그다가 되었어요!</h2><p>500P를 사용하면 {{original.name}}의 기본 모습(1단계)으로 돌아갑니다. 레벨·보유 아이템·구매한 스킨은 유지돼요.</p><button v-if="!confirm" :disabled="s.data.coins<500" @click="confirm=true">{{original.name}}로 복구 · 500 P</button><div v-else class="toolbar" role="group" aria-label="디그다 복구 확인"><b>500P를 사용해 복구할까요?</b><button :disabled="busy||s.data.coins<500" @click="restore">{{busy?'복구 중…':'500 P 사용하고 복구'}}</button><button class="light" :disabled="busy" @click="confirm=false">취소</button></div><p v-if="s.data.coins<500">복구에 500P가 필요해요. 퀴즈와 게임으로 포인트를 모아 주세요.</p><p v-if="error" role="alert">{{error}}</p></section></template>
<style scoped>.diglett-recovery{margin:14px 0}.diglett-recovery h2{font-size:19px}.diglett-recovery p{font-size:12px;line-height:1.8}.diglett-recovery .toolbar{flex-wrap:wrap;gap:10px}</style>
