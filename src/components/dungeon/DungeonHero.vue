<script setup>
import {heroPixels,spritePalette} from '../../data/dungeon-sprites'
defineProps({hero:{type:String,default:'ranger'}})
</script>
<template><svg viewBox="0 0 16 20" class="dungeon-hero-sprite" aria-hidden="true" shape-rendering="crispEdges"><template v-for="(row,y) in heroPixels[hero]" :key="y"><template v-for="(pixel,x) in row" :key="x"><rect v-if="pixel!=='.'" :x="x" :y="y" width="1" height="1" :fill="spritePalette[pixel]"/></template></template></svg></template>
<style scoped>.dungeon-hero-sprite{height:120px;width:96px;image-rendering:pixelated;display:block;margin:0 auto}</style>
