<script setup>
import {ref,computed,onMounted,onUnmounted} from 'vue'
import {useArcade} from '../stores/arcade'
import {useLearning} from '../stores/learning'
import {useMessages} from '../stores/messages'
import EvolutionGuide from '../components/EvolutionGuide.vue'
import DiglettRecovery from '../components/DiglettRecovery.vue'
import PetNameDialog from '../components/PetNameDialog.vue'
import PetEnhancement from '../components/PetEnhancement.vue'
import SkinShop from '../components/SkinShop.vue'
import DailyNotes from '../components/DailyNotes.vue'
import GameHeader from '../components/GameHeader.vue'
import CharacterPicker from '../components/CharacterPicker.vue'
import PartnerImage from '../components/PartnerImage.vue'
import PixelDecor from '../components/PixelDecor.vue'
import DressedPartner from '../components/DressedPartner.vue'
import RoomScene from '../components/RoomScene.vue'
import RoomControls from '../components/RoomControls.vue'
import {useRoom} from '../stores/room'
import ItemSlotWindow from '../components/ItemSlotWindow.vue'
const nameOpen=ref(false),skinOpen=ref(false),notesOpen=ref(false);const messages=useMessages(),learning=useLearning();const room=useRoom();onMounted(()=>{learning.load();room.load()});const s=useArcade();s.age();const p=computed(()=>s.data.pet);const message=ref('파트너와 행복한 하루를 보내요!');const started=ref(false)
import {items} from '../data/items'
const careBusy=ref(false),selectedCare=ref('');let careKey=null,careAction=null,spaceHeld=false,spaceTimer;
function stopSpace(){spaceHeld=false;clearTimeout(spaceTimer)}
async function repeatSpace(){if(!spaceHeld||document.hidden||!started.value||document.querySelector('dialog[open]'))return stopSpace();if(!careBusy.value){const ok=await care(selectedCare.value);if(!ok)return stopSpace()}if(spaceHeld)spaceTimer=setTimeout(repeatSpace,300)}
function careSpace(event,type){if(event.code!=='Space')return;event.preventDefault();if(event.repeat||spaceHeld)return;selectedCare.value=type;spaceHeld=true;repeatSpace()}
function selectCare(type){stopSpace();selectedCare.value=type;care(type)}
function spaceVisibility(){if(document.hidden)stopSpace()}
onMounted(()=>{window.addEventListener('keyup',stopOnSpace);window.addEventListener('blur',stopSpace);document.addEventListener('visibilitychange',spaceVisibility)})
function stopOnSpace(e){if(e.code==='Space')stopSpace()}
onUnmounted(()=>{stopSpace();window.removeEventListener('keyup',stopOnSpace);window.removeEventListener('blur',stopSpace);document.removeEventListener('visibilitychange',spaceVisibility)})
const heartBurst=ref(false),heartKey=ref(0);let heartTimer;onUnmounted(()=>clearTimeout(heartTimer));
async function care(type){if(careBusy.value)return;careBusy.value=true;const action=type==='food'?'food':'play';if(careAction!==action||!careKey){careKey=crypto.randomUUID();careAction=action}try{await s.petAction(action,undefined,careKey);careKey=null;heartKey.value++;heartBurst.value=true;clearTimeout(heartTimer);heartTimer=setTimeout(()=>heartBurst.value=false,1600);message.value='파트너가 기뻐해요!';return true}catch(e){message.value=e.message;return false}finally{careBusy.value=false}}

</script>
<template><GameHeader tag="03 / MY LITTLE FRIEND" title="마이 리틀 펫" description="먹이(10코인)와 놀이(5코인)로 경험치를 모아요. 100경험치마다 레벨 업! 포만감과 행복은 시간에 따라 천천히 줄어듭니다."/><div class="pet-study-menu"><button class="light" @click="nameOpen=true">✎ 파트너 이름 정하기</button><button class="light" @click="skinOpen=true">✦ 스킨 상점 · {{s.partner.stage*500}} P</button><button class="light" @click="notesOpen=true">✎ 오늘 배운 내용 정리하기</button><RouterLink to="/workshop" class="button light">문제 제작소 →</RouterLink><RouterLink to="/pet" class="button light">파트너 돌보기</RouterLink><RouterLink to="/pet/mistakes" class="button light">틀린 문제! <b>{{learning.pendingCount}}</b> →</RouterLink><RouterLink to="/pet/mailbox" class="button light">✉ 내 쪽지함 <b v-if="messages.unread" class="unread-badge">{{messages.unread}}</b></RouterLink></div><DiglettRecovery/><EvolutionGuide v-if="s.partner.id!=='diglett'"/><div class="friendship-banner"><PixelDecor kind="hearts"/><div><p class="eyebrow">LITTLE FRIEND, BIG HEART</p><h3>오늘도 함께 자라는 중!</h3></div><PixelDecor kind="clover"/></div><section class="panel partner-select-panel"><div class="partner-select-heading"><p class="eyebrow">MY FOREVER PARTNER</p><h2>우리의 모험은 여기서 시작!</h2></div><CharacterPicker :model-value="s.partner.id" :locked="s.data.partnerLocked" @update:model-value="s.selectCharacter"/></section><div v-if="!started" class="panel empty"><PartnerImage size="large"/><h2>{{s.petName}}와 함께 놀까요?</h2><p>성장은 자동 저장되며 다시 만날 때도 이어집니다.</p><button @click="started=true">만나기 시작</button></div><div v-else class="pet-layout"><div class="panel"><RoomScene class="pet-scene"><div v-if="heartBurst" :key="heartKey" class="care-heart-burst" aria-hidden="true"><span v-for="i in 8" :key="i" :style="{'--heart-i':i}">♥</span></div><span class="cloud">☁</span><DressedPartner size="scene"/><span class="grass">🌼 🌱 🌷</span><PixelDecor kind="hearts" class="pet-scene-hearts"/></RoomScene><RoomControls/><h2 class="center">{{s.petName}} <small v-if="s.data.pet.nickname">({{s.partner.name}})</small> <span class="level">Lv.{{s.level}}</span></h2><p class="center" role="status">{{message}}</p><div class="pet-meters"><label>포만감 <b>{{Math.round(p.hunger)}} / 100</b><progress :value="p.hunger" max="100"/></label><label>행복 <b>{{Math.round(p.happy)}} / 100</b><progress :value="p.happy" max="100"/></label><label>경험치 <b>{{p.xp%100}} / 100</b><progress :value="p.xp%100" max="100"/></label></div><div class="toolbar"><button :aria-busy="careBusy" @blur="stopSpace" @keydown="careSpace($event,'food')" @click="selectCare('food')">🍎 먹이 주기 · 10 🪙</button><button :aria-busy="careBusy" @blur="stopSpace" @keydown="careSpace($event,'play')" @click="selectCare('play')">🎾 놀아주기 · 5 🪙</button></div><p class="care-keyboard-help">버튼을 클릭한 뒤 스페이스바를 누르거나 꾹 누르면 반복돼요. 먹이 10코인 · 놀이 5코인이 매번 사용됩니다.</p><button class="text-button" @click="stopSpace();started=false;message='다시 만나서 반가워요!'">↻ 돌보기 재시작 (성장 유지)</button></div><ItemSlotWindow :items="items"/></div><PetNameDialog v-if="nameOpen" @close="nameOpen=false"/><PetEnhancement/><SkinShop v-if="skinOpen" @close="skinOpen=false"/><DailyNotes v-if="notesOpen" @close="notesOpen=false"/></template>
