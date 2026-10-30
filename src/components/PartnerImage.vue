<script setup>
import {computed} from 'vue'
import {useArcade} from '../stores/arcade'
import {characterAtStage} from '../data/evolutions'
const props=defineProps({character:String,stage:Number,formId:String,size:{type:String,default:'medium'}})
const s=useArcade(),partner=computed(()=>props.character?characterAtStage(props.character,props.stage??1,props.formId):s.partner)
</script>
<template><img :src="partner.image" :alt="partner.name" :class="['partner-image','partner-'+size]" draggable="false"/></template>
