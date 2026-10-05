<script setup>
// 看图算（第 4 课）这一步画的天平：
//   比一比：两架天平放在一起，一样的东西划掉，多出来的亮着；算对了，下面出现“多出来的”那一架
//   换一换：知道的东西变成砝码；算对了，两边一起拿走这些砝码，剩下要求的那一样
// 例题里这一步一出来就播放；练习时先停在要算的样子，孩子填对了才播放。点一下可以再看一次。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BalanceScale from './BalanceScale.vue'
import { t } from '../i18n.js'
import { play } from '../sound.js'

const props = defineProps({
  step: { type: Object, required: true },
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  floats: { type: Object, default: () => ({}) },
  play: { type: Boolean, default: true },
})

const visual = computed(() => props.step.visual)
// 0：题目里的样子；1：要算的样子（知道的东西变成砝码 / 一样的划掉）；2：算出来了
const stage = ref(props.play && props.step.visual.look === 'swap' ? 0 : 1)
const event = ref(null)
let timers = []

const later = (ms, fn) => timers.push(setTimeout(fn, ms))
function stop() {
  timers.forEach(clearTimeout)
  timers = []
}

function show(next, floats) {
  stage.value = next
  const scale = next === 2 ? visual.value.after : visual.value.mid
  event.value = floats ? { kind: props.step.kind, scaleIds: [scale.id], key: Date.now(), ...floats } : null
  // 声音跟着天平变：东西变成砝码“翻一下”，两边拿走砝码“往上一提”，比出多出来的“比一比”，最后“算出来了”
  if (next === 1) play('swap')
  if (next === 2) {
    play(visual.value.look === 'swap' ? 'takeAway' : 'compare')
    play('found', 0.45)
  }
}

function run(fromStart) {
  stop()
  event.value = null
  const finish = () => show(2, { left: props.floats.left ?? null, right: props.floats.right ?? null })
  if (!fromStart) {
    later(150, finish)
    return
  }
  if (visual.value.look === 'swap') {
    stage.value = 0
    later(700, () => show(1, { left: props.floats.swap ?? null, right: null }))
    later(2400, finish)
  } else {
    stage.value = 1
    later(1800, finish)
  }
}

onMounted(() => {
  if (props.play) run(true)
})
watch(
  () => props.play,
  (now) => {
    if (now) run(false)
  },
)
onBeforeUnmount(stop)

function replay() {
  if (props.play) run(true)
}

const shown = computed(() => [visual.value.before, visual.value.mid, visual.value.after][stage.value] || visual.value.after)
</script>

<template>
  <figure class="look-scale" :class="`look-${visual.look}`">
    <button type="button" class="look-button" :disabled="!play" :aria-label="t('work.replay')" @click="replay">
      <template v-if="visual.look === 'compare'">
        <span class="pair">
          <template v-for="(source, k) in visual.sources" :key="source.id">
            <span v-if="k > 0" class="vs" aria-hidden="true">{{ t('look.vs') }}</span>
            <span class="source">
              <span class="scale-tag">{{ t('scale.name', { id: source.id }) }}</span>
              <BalanceScale :scale="source" :items="items" :theme="theme" :cancel="visual.cancel" />
            </span>
          </template>
        </span>
        <Transition name="rise">
          <span v-if="stage === 2" class="result">
            <span class="scale-tag extra-tag">{{ t('look.extraTag') }}</span>
            <BalanceScale :scale="visual.after" :items="items" :theme="theme" :event="event" />
          </span>
        </Transition>
      </template>
      <template v-else>
        <span class="scale-tag">{{ t('scale.name', { id: shown.id }) }}</span>
        <BalanceScale :scale="shown" :items="items" :theme="theme" :event="event" />
      </template>
    </button>
    <figcaption v-if="play" class="replay">↻ {{ t('work.replay') }}</figcaption>
  </figure>
</template>

<style scoped>
.look-scale {
  margin: 0;
  display: grid;
  gap: 2px;
  justify-items: center;
}
.look-button {
  width: 100%;
  display: grid;
  gap: 6px;
  padding: 6px 8px 8px;
  border: 0;
  border-radius: 18px;
  background: var(--paper);
  box-shadow: 0 2px 0 var(--paper-line);
  font: inherit;
  cursor: pointer;
}
.look-button:disabled {
  cursor: default;
}
.scale-tag {
  justify-self: start;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.9rem;
}
.extra-tag {
  background: var(--sun);
}
.pair {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  align-items: center;
  gap: 4px;
}
.source {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.vs {
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--coral-dark);
}
/* 手机上两架天平上下排，划掉的东西才看得清 */
@media (max-width: 600px) {
  .pair {
    grid-template-columns: minmax(0, 1fr);
    justify-items: stretch;
  }
  .vs {
    justify-self: center;
    line-height: 1;
  }
}
.result {
  display: grid;
  gap: 2px;
  justify-self: center;
  width: min(100%, 300px);
  padding-top: 6px;
  border-top: 2px dashed var(--paper-line);
}
.replay {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-soft);
}
.rise-enter-active {
  transition: opacity 0.4s ease-out, transform 0.4s ease-out;
}
.rise-enter-from {
  opacity: 0;
  transform: translateY(10px);
}
@media (prefers-reduced-motion: reduce) {
  .rise-enter-active {
    transition: none;
  }
}
</style>
