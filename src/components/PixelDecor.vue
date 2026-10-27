<script setup>
defineProps({kind:{type:String,default:'clover'}})
const assets={clover:'/images/decor/clover.png',box:'/images/decor/question-box.png',hearts:'/images/decor/hearts.png'}
</script>
<template><span :class="['pixel-decor','pixel-decor-'+kind]" aria-hidden="true"><img :src="assets[kind]||assets.clover" alt="" draggable="false"/></span></template>
