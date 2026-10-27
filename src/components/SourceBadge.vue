<script setup>
defineProps({source:{type:String,default:'official'},creatorName:String,creatorId:String,postId:String,version:Number})
</script>
<template><span class="problem-origin"><span :class="['source-badge',source]">{{source==='student'?'학생 제작':'공식 문제'}}</span><template v-if="source==='student'"><RouterLink v-if="creatorId" :to="{path:'/workshop',query:{creator:creatorId}}">{{creatorName||'학생'}} 제작</RouterLink><span v-else>{{creatorName}} 제작</span><RouterLink v-if="postId" :to="{path:'/workshop',query:{post:postId}}">원본 게시글 ↗</RouterLink></template><small v-if="version">v{{version}}</small></span></template>
