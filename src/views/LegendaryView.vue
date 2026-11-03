<script setup>
import { onMounted, ref } from 'vue'
import { api } from '../lib/api'
import { useArcade } from '../stores/arcade'

const arcade = useArcade()
const dex = ref(null)
const captured = ref(null)
const captureDialog = ref(null)
const busy = ref(false)
const error = ref('')
let pendingClaim

async function refresh() {
  dex.value = await api('/legendary')
}

async function act(task) {
  if (busy.value) return
  busy.value = true
  error.value = ''
  try {
    await task()
  } catch (failure) {
    error.value = failure.message
  } finally {
    busy.value = false
  }
}

function claim(kind, condition) {
  return act(async () => {
    if (pendingClaim?.kind !== kind || pendingClaim?.condition !== condition) pendingClaim = { kind, condition, requestKey: crypto.randomUUID() }
    const { pokemon } = await api('/legendary/claim', { method: 'POST', body: pendingClaim })
    pendingClaim = null
    captured.value = pokemon
    captureDialog.value?.showModal()
    await refresh()
  })
}

function equip(id) {
  return act(async () => {
    await api('/legendary/equip', { method: 'POST', body: { id } })
    await arcade.refresh()
    await refresh()
  })
}

onMounted(() => act(refresh))
</script>

<template>
  <section class="legendary-dex">
    <header class="legendary-title">
      <div><small>✦ LEGENDARY POKÉDEX</small><h1>전설의 포켓몬 도감</h1></div>
      <RouterLink to="/collection" class="button light">일반 도감</RouterLink>
    </header>
    <p v-if="error" class="notice" role="alert">{{ error }}</p>
    <p v-if="!dex && busy" role="status">전설 도감을 불러오는 중이에요…</p>
    <button v-if="!dex && !busy" @click="act(refresh)">다시 불러오기</button>
    <template v-if="dex">
      <section class="panel">
        <h2>전설의 기록 {{ dex.entries.length }} / {{ dex.total }}</h2>
        <div class="legendary-grid">
          <article v-for="slot in dex.total" :key="slot" :class="{ discovered: dex.entries[slot-1] }">
            <template v-if="dex.entries[slot-1]">
              <img :src="dex.entries[slot-1].image" :alt="dex.entries[slot-1].name" />
              <strong>{{ dex.entries[slot-1].name }}</strong>
              <small>{{ dex.entries[slot-1].type }}</small>
              <button :disabled="busy || dex.current===dex.entries[slot-1].id" @click="equip(dex.entries[slot-1].id)">
                {{ dex.current===dex.entries[slot-1].id ? '선택됨' : '파트너 선택' }}
              </button>
            </template>
            <template v-else><span class="secret-mark" aria-hidden="true">?</span><strong>미공개</strong></template>
          </article>
        </div>
      </section>
      <section class="panel legendary-final">
        <div>
          <h2>{{ dex.final?.name ?? '최종 보상 · 미공개' }}</h2>
          <p>전설 도감 7칸을 모두 채우면 마지막 포켓몬을 수령할 수 있어요.</p>
          <button v-if="dex.canClaimFinal" :disabled="busy" @click="claim('final')">최종 보상 수령 ✦</button>
          <button v-if="dex.final" :disabled="busy || dex.current===dex.final.id" @click="equip(dex.final.id)">
            {{ dex.current===dex.final.id ? '선택됨' : '파트너 선택' }}
          </button>
        </div>
        <img v-if="dex.final" :src="dex.final.image" :alt="dex.final.name" />
      </section>
      <section class="panel">
        <h2>수령 방법</h2>
        <p>조건을 하나 달성할 때마다 해당 조건에서 전설 포켓몬 한 마리를 수령할 수 있어요. 각 조건은 한 번만 수령할 수 있어요. 첫 수령은 각 포켓몬이 1/7 확률로 등장하고, 다음부터는 미획득 포켓몬 중 한 마리가 같은 확률로 등장해요.</p>
        <ul class="legendary-checks">
          <li v-for="check in dex.checks" :key="check.id">
            <span>{{ check.done ? '✓' : '○' }} {{ check.label }}</span>
            <strong>{{ check.minutes === undefined ? check.progress + ' / ' + check.total : check.minutes + '분' }}</strong>
            <button :disabled="busy || !check.done || check.claimed" @click="claim('draw', check.id)">
              {{ check.claimed ? '수령 완료' : '수령' }}
            </button>
          </li>
        </ul>
        <p>퀘스트는 목표 달성을 확인해요. 퀴즈는 공식 문제마다 한 번 이상 답안을 제출하면 돼요. 획득한 전설 포켓몬은 진화 없이 함께할 수 있고, 전용 이로치 스킨은 마이 리틀 펫의 스킨 상점에서 500P로 구매할 수 있어요.</p>
        <button class="light" :disabled="busy" @click="act(refresh)">달성 현황 새로고침</button>
      </section>
    </template>
    <dialog ref="captureDialog" class="capture-dialog" aria-labelledby="capture-title">
      <div v-if="captured" :key="captured.id" class="capture-stage" :class="{ radiant: captured.id==='legendary-arceus' }">
        <span v-for="star in 8" :key="star" class="capture-star" :style="{ '--star': star }" aria-hidden="true">✦</span>
        <img :src="captured.image" :alt="captured.name" />
        <span class="capture-ball" aria-hidden="true"></span>
      </div>
      <h2 id="capture-title">{{ captured?.name }} 획득!</h2>
      <p>전설 도감에 새로운 기록이 추가됐어요.</p>
      <button @click="captureDialog.close()">확인</button>
    </dialog>
  </section>
</template>

<style scoped>
.legendary-dex{width:100%;min-width:0}
.legendary-title,.legendary-final{display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
.legendary-title h1{font-size:clamp(22px,4vw,34px);margin:8px 0}
.legendary-title small{color:var(--rpg-ink)}
.legendary-dex .panel{margin:16px 0}
.legendary-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,max(135px,calc((100% - 72px) / 7))),1fr));gap:12px;margin-bottom:18px}
.legendary-grid article{display:grid;justify-items:center;align-content:center;gap:8px;min-height:168px;text-align:center;padding:10px;border:2px dashed var(--rpg-mid);background:var(--rpg-soft);border-radius:10px}
.legendary-grid .discovered{border-style:solid}
.legendary-grid img,.legendary-final img{width:105px;height:95px;object-fit:contain}
.legendary-grid button{font-size:11px;padding:6px 10px}
.secret-mark{font-size:48px;color:var(--rpg-edge)}
.legendary-checks{list-style:none;padding:0;display:grid;gap:8px}
.legendary-checks li{display:flex;gap:10px;justify-content:space-between;align-items:center;flex-wrap:wrap;padding:10px;background:var(--rpg-soft);border-radius:6px;font-size:13px}
.legendary-checks strong{white-space:nowrap}
.capture-dialog{width:min(420px,calc(100vw - 24px));text-align:center;background:var(--rpg-paper);color:var(--rpg-ink);border:3px solid var(--rpg-edge);border-radius:14px;padding:20px}
.capture-dialog::backdrop{background:#152539a8}
.capture-stage{height:208px;position:relative;overflow:hidden;background:var(--rpg-soft);border-radius:10px;margin-bottom:14px}
.capture-stage img{position:absolute;width:138px;height:138px;object-fit:contain;left:calc(50% - 69px);top:12px;animation:capture-in 1.5s ease-in-out forwards}
.capture-ball{position:absolute;bottom:17px;left:calc(50% - 25px);width:50px;height:50px;border:4px solid #253147;border-radius:50%;background:linear-gradient(#f35962 0 45%,#253147 45% 55%,#fff 55%);animation:capture-wiggle 1.5s ease-in-out}
.capture-ball::after{content:'';position:absolute;inset:13px;border:3px solid #253147;border-radius:50%;background:white}
.capture-star{display:none;position:absolute;top:43%;left:calc(var(--star)*11%);color:#9a6a00;font-size:26px}
.radiant{background:radial-gradient(circle,#fff6bd,var(--rpg-soft) 74%)}
.radiant .capture-star{display:block;animation:capture-spark 1.2s ease-out both;animation-delay:calc(.6s + var(--star)*.07s)}
@keyframes capture-in{0%,32%{opacity:1;transform:none}75%,100%{opacity:0;transform:translateY(112px) scale(.06)}}
@keyframes capture-wiggle{0%,55%,100%{transform:none}67%,87%{transform:rotate(-13deg)}77%{transform:rotate(13deg)}}
@keyframes capture-spark{0%{opacity:0;transform:scale(.3)}40%{opacity:1}100%{opacity:.45;transform:translateY(-55px) scale(1.2)}}
@media(prefers-reduced-motion:reduce){.capture-stage *{animation:none!important}}
</style>
