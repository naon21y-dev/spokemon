<script setup>
defineProps({hero:{type:String,default:'ranger'}})
</script>
<template><svg viewBox="0 0 24 32" class="dungeon-hero-sprite" aria-hidden="true" shape-rendering="crispEdges"><path fill="#182b38" d="M5 28h14v3H5zM6 20h5v9H6zM14 20h4v9h-4z"/><path :fill="hero==='scholar'?'#72a5d6':hero==='smith'?'#d79b51':'#5cac77'" d="M5 13h14v12H5zM2 15h4v8H2zM18 15h4v8h-4z"/><path fill="#dcb489" d="M6 5h12v10H6zM2 21h4v3H2zM18 21h4v3h-4z"/><path fill="#f0ce77" d="M5 2h14v5H5zM3 6h18v3H3zM8 18h8v3H8z"/><path fill="#1a303e" d="M8 10h2v3H8zM15 10h2v3h-2z"/></svg></template>
<style scoped>.dungeon-hero-sprite{height:100px;width:75px;image-rendering:pixelated;display:block;margin:0 auto}</style>
