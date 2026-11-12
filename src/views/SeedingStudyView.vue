<script setup>
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { api } from '../lib/api'
import { useStudyActivity } from '../composables/useStudyActivity'

const route = useRoute()
const study = ref(null)
const subject = ref('')
const search = ref('')
const hideAnswers = ref(false)
const revealed = ref(new Set())
const error = ref('')
const loading = ref(false)
let visibilityPoll

const cards = computed(() => {
  const term = search.value.trim().toLowerCase()
  return (study.value?.cards ?? []).filter(card =>
    card.subject === subject.value &&
    [card.prompt, card.code, card.answer, card.explanation].join(' ').toLowerCase().includes(term)
  )
})

useStudyActivity(() => study.value ? { kind: 'seeding-study', subject: subject.value } : null)

async function load() {
  loading.value = true
  error.value = ''
  try {
    const data = await api('/seeding/study')
    selectSubject(data.subjects.find(item => item.id === route.query.subject)?.id ?? data.subjects[0].id)
    study.value = data
  } catch (err) {
    error.value = err.message
  } finally {
    loading.value = false
  }
}

function selectSubject(id) {
  subject.value = id
  search.value = ''
  revealed.value.clear()
}

function toggleMemorization() {
  hideAnswers.value = !hideAnswers.value
  revealed.value.clear()
}

function toggleAnswer(id) {
  if (revealed.value.has(id)) revealed.value.delete(id)
  else revealed.value.add(id)
}

async function checkVisibility() {
  if (!study.value || document.hidden) return
  try {
    const settings = await api('/seeding/settings', { background: true })
    if (!settings.enabled) {
      study.value = null
      error.value = "GT's seeding은 지금 쉬고 있어요."
    }
  } catch {
    // Keep the loaded cards available during a temporary connection failure.
  }
}

onMounted(() => {
  load()
  visibilityPoll = setInterval(checkVisibility, 15000)
})
onUnmounted(() => clearInterval(visibilityPoll))
</script>

<template>
  <section class="seeding-study">
    <div class="panel study-intro">
      <div>
        <h1>📖 GT's seeding 공부하기</h1>
        <p>문제를 읽고 정답과 해설을 확인하세요. 외웠다면 답을 가리고 다시 떠올려 보세요.</p>
      </div>
      <RouterLink :to="{ path: '/seeding', query: { subject } }" class="button light">시험 선택으로</RouterLink>
    </div>

    <p v-if="loading" role="status">공부 카드를 불러오는 중이에요…</p>
    <div v-else-if="error" class="panel">
      <p role="alert">{{ error }}</p>
      <button type="button" @click="load">다시 불러오기</button>
    </div>

    <template v-else-if="study">
      <div class="panel study-controls">
        <fieldset>
          <legend>과목</legend>
          <div class="subject-buttons">
            <button v-for="item in study.subjects" :key="item.id" type="button"
              :class="{ light: subject !== item.id }" :aria-pressed="subject === item.id"
              @click="selectSubject(item.id)">
              {{ item.name }} · {{ item.count }}문제
            </button>
          </div>
        </fieldset>
        <div class="study-tools">
          <label>공부 카드 검색
            <input v-model="search" type="search" placeholder="예: fit, 정규화, DataFrame" />
          </label>
          <button type="button" class="light" :aria-pressed="hideAnswers" @click="toggleMemorization">
            {{ hideAnswers ? '정답과 해설 모두 보기' : '정답 가리고 외우기' }}
          </button>
        </div>
      </div>
      <p class="card-count" aria-live="polite">{{ cards.length }}문제</p>
      <p v-if="!cards.length">검색어와 일치하는 문제가 없어요.</p>

      <div class="study-cards">
        <article v-for="card in cards" :key="card.id" class="panel study-card">
          <h2>{{ card.prompt }}</h2>
          <pre v-if="card.code"><code>{{ card.code }}</code></pre>
          <button v-if="hideAnswers" type="button" class="light reveal-answer"
            :aria-expanded="revealed.has(card.id)" :aria-controls="'study-answer-' + card.id"
            @click="toggleAnswer(card.id)">
            {{ revealed.has(card.id) ? '이 카드의 정답 가리기' : '이 카드의 정답 보기' }}
          </button>
          <div :id="'study-answer-' + card.id" class="study-answer"
            v-show="!hideAnswers || revealed.has(card.id)">
            <p><strong>정답</strong> <b>{{ card.answer }}</b></p>
            <p><strong>해설</strong> {{ card.explanation }}</p>
          </div>
        </article>
      </div>
    </template>
  </section>
</template>

<style scoped>
.seeding-study { display: grid; gap: 16px; width: 100%; max-width: 1100px; min-width: 0; margin: 0 auto; }
.seeding-study .panel { min-width: 0; margin: 0; padding: clamp(16px, 3vw, 26px); box-sizing: border-box; }
.study-intro { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
.study-intro h1 { margin: 0; font-size: clamp(19px, 3.2vw, 28px); }
.study-intro p { margin: 8px 0 0; line-height: 1.7; }
.study-controls { display: grid; gap: 16px; }
.study-controls fieldset { min-width: 0; margin: 0; padding: 0; border: 0; }
.study-controls legend { padding: 0; margin-bottom: 8px; font-weight: bold; }
.subject-buttons, .study-tools { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
.study-tools label { display: grid; gap: 6px; min-width: 0; flex: 1 1 230px; font-size: 13px; }
.study-tools input { box-sizing: border-box; width: 100%; min-width: 0; margin: 0; font-size: 16px; }
.seeding-study button, .study-intro .button { min-width: 0; max-width: 100%; margin: 0; white-space: normal; }
.card-count { margin: 0; font-size: 13px; }
.study-cards { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
.study-card { overflow-wrap: anywhere; }
.study-card h2 { font-size: 16px; line-height: 1.65; margin: 0 0 12px; }
.study-card pre { box-sizing: border-box; max-width: 100%; overflow: auto; padding: 12px; background: #182539; color: #f0f5ff; border-radius: 5px; font: 12px/1.7 monospace; white-space: pre; }
.study-card pre code { color: inherit; }
.study-answer { background: var(--rpg-soft); border-left: 3px solid var(--rpg-edge); padding: 10px 12px; margin-top: 12px; }
.study-answer p { margin: 0; line-height: 1.75; font-size: 14px; }
.study-answer p + p { margin-top: 8px; }
.study-answer strong { margin-right: 7px; color: var(--rpg-edge); }
@media (max-width: 700px) {
  .study-cards { grid-template-columns: minmax(0, 1fr); }
  .study-intro, .study-tools { align-items: stretch; }
}
</style>
