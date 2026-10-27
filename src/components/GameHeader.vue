<script setup>
import PixelDecor from './PixelDecor.vue'
import {useArcade} from '../stores/arcade'
const arcade=useArcade()
defineProps(['tag','title','description'])
</script>
<template><div class="game-heading"><RouterLink v-if="arcade.user?.role!=='admin'" to="/home" class="back">← 메인으로</RouterLink><p class="eyebrow">{{tag}}</p><div class="decorated-title"><h1>{{title}}</h1><PixelDecor kind="clover" class="heading-clover"/></div><p>{{description}}</p></div></template>
