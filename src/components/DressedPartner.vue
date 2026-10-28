<script setup>
import {computed} from 'vue'
import {useArcade} from '../stores/arcade'
import {accessoryPlacement} from '../data/accessories'
import {itemMap} from '../data/items'
import PartnerImage from './PartnerImage.vue'
const props=defineProps({size:{type:String,default:'scene'}}),arcade=useArcade(),item=computed(()=>arcade.data.pet.wear),placement=computed(()=>accessoryPlacement(arcade.partner.id,item.value)),style=computed(()=>({'--dress-ratio':placement.value.ratio,'--wear-x':placement.value.x+'%','--wear-y':placement.value.y+'%','--wear-size':placement.value.size,'--wear-offset':placement.value.offset,'--wear-rotation':placement.value.rotation+'deg'}))
</script>
<template><span :class="['dressed-partner','dressed-partner-'+size]" :data-character="arcade.partner.id" :style="style"><img v-if="size==='scene'&&arcade.skin" :src="arcade.skin.image" :alt="arcade.partner.name+' · '+arcade.skin.name" class="partner-image partner-scene scene-skin" :data-skin="arcade.skin.id" draggable="false"/><PartnerImage v-else :size="size"/><span v-if="item" :class="['partner-accessory',size==='device'?'device-partner-wear':'hat']" :data-kind="placement.kind" :aria-label="'착용 아이템: '+(itemMap[item]?.name??item)">{{item}}</span></span></template>
<style scoped>
.dressed-partner{display:inline-block;position:relative;aspect-ratio:var(--dress-ratio);flex:none;container-type:inline-size;isolation:isolate;vertical-align:middle}.dressed-partner-scene{--dress-height:clamp(145px,18dvh,175px);width:min(calc(var(--dress-height)*var(--dress-ratio)),80%)}.dressed-partner-device{width:min(110px,100%)}.dressed-partner :deep(img.partner-image){display:block;width:100%;height:100%;max-width:none;max-height:none;object-fit:contain;position:relative;z-index:1}.dressed-partner>.partner-accessory{position:absolute;left:var(--wear-x);top:var(--wear-y);font-size:calc(var(--wear-size)*1cqw);line-height:1;font-family:'Segoe UI Emoji','Apple Color Emoji','Noto Color Emoji',sans-serif;transform:translate(-50%,var(--wear-offset)) rotate(var(--wear-rotation));z-index:3;pointer-events:none;white-space:nowrap;filter:drop-shadow(0 2px 1px #23334a30)}.partner-accessory[data-kind='aura']{z-index:0}.partner-accessory[data-kind='ornament']{transform:translate(-50%,-50%) rotate(9deg)}@media(max-width:600px){.dressed-partner-device{width:min(90px,100%)}}
</style>
