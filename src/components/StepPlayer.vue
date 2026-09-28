<script setup>
// 讲解：老师把例题一步一步演算出来。每点一次“下一步”，演算纸上多写一步，天平跟着变；
// 前面写过的步骤一直留着，最后写出答案，再把答案放回每架天平检查。
import { computed, ref } from 'vue'
import ScaleBoard from './ScaleBoard.vue'
import WorkSheet from './WorkSheet.vue'
import { buildWorking } from '../core/working.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { makeWords } from '../words.js'

const props = defineProps({
  puzzle: { type: Object, required: true },
  tools: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  finishLabel: { type: String, required: true },
})
const emit = defineEmits(['finish'])

const words = makeWords(props.puzzle.items, props.theme)
const work = buildWorking(props.puzzle, props.tools)
const total = work.steps.length
// 0：只写题目；1…total：写到第几步；total + 1：写出答案并检查
const page = ref(0)
const event = ref(null)

const upto = computed(() => Math.min(page.value, total))
const done = computed(() => page.value > total)
const board = computed(() => (upto.value === 0 ? props.puzzle.board : work.steps[upto.value - 1].board))
const active = computed(() => (page.value >= 1 && page.value <= total ? work.steps[page.value - 1].event?.scaleIds || [] : []))

function next() {
  if (done.value) return
  page.value++
  const step = work.steps[page.value - 1]
  event.value = step?.event ? { ...step.event, key: Date.now() } : null
  play(done.value ? 'found' : 'move')
}

function prev() {
  if (page.value === 0) return
  page.value--
  event.value = null
  play('tap')
}

function replay() {
  page.value = 0
  event.value = null
  play('tap')
}
</script>

<template>
  <div class="study">
    <ScaleBoard :board="board" :items="puzzle.items" :theme="theme" :event="event" :active="active" />
    <WorkSheet :work="work" :words="words" :upto="upto" :done="done">
      <div class="sheet-actions">
        <span class="step-count">{{ upto > 0 ? t('teach.stepCount', { n: upto, total }) : '' }}</span>
        <button type="button" class="btn btn-soft" :disabled="page === 0" @click="prev">← {{ t('teach.prev') }}</button>
        <button v-if="!done" type="button" class="btn btn-primary" @click="next">{{ t('teach.next') }} →</button>
        <template v-else>
          <button type="button" class="btn btn-soft" @click="replay">↺ {{ t('teach.replay') }}</button>
          <button type="button" class="btn btn-primary" @click="emit('finish')">{{ finishLabel }} ▶</button>
        </template>
      </div>
    </WorkSheet>
  </div>
</template>

<style scoped>
.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
}
.step-count {
  margin-right: auto;
  font-size: 1rem;
  font-weight: 700;
  color: var(--teal);
}
</style>
