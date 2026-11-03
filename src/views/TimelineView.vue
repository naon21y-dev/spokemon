<script setup>
import {onMounted,ref} from 'vue'
import {api} from '../lib/api'
import {useTimeline} from '../stores/timeline'

const timeline=useTimeline()
const items=ref([]),busy=ref(false),more=ref(false),error=ref('')
const labels={update:'업데이트','comment-written':'남긴 댓글','comment-received':'받은 댓글',legendary:'전설의 포켓몬'}
async function load(append=false,markRead=false){
  if(busy.value)return
  busy.value=true
  error.value=''
  try{
    if(markRead)await api('/timeline/read',{method:'POST'})
    const data=await api('/timeline?offset='+(append?items.value.length:0))
    items.value=append?[...new Map([...items.value,...data.items].map(item=>[item.id,item])).values()]:data.items
    more.value=data.more
    await timeline.refresh()
  }catch(e){error.value=e.message}finally{busy.value=false}
}
onMounted(()=>load())
</script>

<template>
  <section class="panel timeline">
    <header>
      <div><h1>활동 타임라인</h1><p>Spokemon 소식과 나의 활동을 최신순으로 확인해요.</p></div>
      <button type="button" class="light" :disabled="busy||!timeline.unread" @click="load(false,true)">모두 읽음</button>
    </header>
    <p v-if="error" role="alert">{{error}}</p>
    <p v-if="busy" role="status">활동을 불러오는 중…</p>
    <p v-else-if="!items.length&&!error">아직 표시할 활동이 없어요.</p>
    <ol class="timeline-list">
      <li v-for="item in items" :key="item.id">
        <div class="timeline-meta">
          <b>{{labels[item.kind]}}</b><strong v-if="item.unread">새 알림</strong>
          <time :datetime="new Date(item.at).toISOString()">{{new Date(item.at).toLocaleString('ko-KR',{timeZone:'Asia/Seoul'})}}</time>
        </div>
        <h2>{{item.kind==='legendary'?item.title+'을(를) 획득했어요!':item.title}}</h2>
        <p v-if="item.kind==='comment-received'">{{item.detail}}님이 내 게시글에 댓글을 남겼어요.</p>
        <p v-else-if="item.kind==='update'">{{item.detail}}</p>
        <RouterLink v-if="item.target" :to="{path:'/sloud',query:{post:item.target}}">게시글 보기 →</RouterLink>
        <RouterLink v-else-if="item.kind==='legendary'" to="/legendary">전설의 포켓몬 도감 →</RouterLink>
      </li>
    </ol>
    <button v-if="more" type="button" class="light" :disabled="busy" @click="load(true)">이전 활동 더 보기</button>
  </section>
</template>

<style scoped>
.timeline{max-width:960px;margin-inline:auto}
.timeline header,.timeline-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.timeline header{justify-content:space-between}
.timeline h1,.timeline h2{margin:0}
.timeline h2{font-size:1rem;overflow-wrap:anywhere}
.timeline-list{display:grid;gap:12px;padding:0;list-style:none}
.timeline-list li{padding:14px;border:1px solid var(--rpg-mid);background:var(--rpg-soft);display:grid;gap:7px}
.timeline-meta{font-size:.8rem}
.timeline-meta strong{padding:2px 6px;border:1px solid currentColor}
.timeline-meta time{margin-inline-start:auto}
.timeline-list p{margin:0}
.timeline-list a{text-decoration:underline;justify-self:start}
</style>
