<script setup>
import {computed} from 'vue'
import {useArcade} from '../stores/arcade'
import {findCharacter} from '../data/characters'
const props=defineProps({character:String,size:{type:String,default:'medium'}})
const s=useArcade(),partner=computed(()=>props.character?findCharacter(props.character):s.partner)
</script>
<template><img :src="partner.image" :alt="partner.name" :class="['partner-image','partner-'+size]" draggable="false"/></template>
