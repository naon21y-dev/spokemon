<script setup>
import {useArcade} from '../stores/arcade'
import SourceBadge from './SourceBadge.vue'
const s=useArcade()
</script>
<template><details class="point-history"><summary>포인트 내역 · 출처와 지급 사유 보기</summary><div class="point-history-body"><p v-if="!s.data.records.length">아직 포인트 내역이 없어요.</p><article v-for="(r,i) in s.data.records" :key="r.at+'-'+i"><div class="workshop-heading"><b>{{r.game}}</b><strong>{{r.coins>0?'+':''}}{{r.coins}} P</strong></div><SourceBadge v-if="r.source" :source="r.source" :creator-name="r.creatorName" :creator-id="r.creatorId" :post-id="r.source==='student'?r.originalId:null" :version="r.version"/><p v-if="r.problemTitle">{{r.problemTitle}}</p><p>{{r.reason||r.detail}}</p><time>{{new Date(r.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}}</time></article></div></details></template>
