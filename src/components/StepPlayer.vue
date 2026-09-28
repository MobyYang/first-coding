<script setup>
// 例题：老师一步一步演算。每点一次“下一步”，演算纸上多写一步：第几步、做什么、为什么、这一步的天平和算式。
// 前面写过的步骤一直留着，最后写出答案，再把答案放回每架天平检查。
import { computed, ref } from 'vue'
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
const upto = computed(() => Math.min(page.value, total))
const done = computed(() => page.value > total)

function next() {
  if (done.value) return
  page.value++
  play(done.value ? 'found' : 'move')
}

function prev() {
  if (page.value === 0) return
  page.value--
  play('tap')
}

function replay() {
  page.value = 0
  play('tap')
}
</script>

<template>
  <WorkSheet :work="work" :words="words" :theme="theme" :title="t('work.titleExample')" :upto="upto" :done="done">
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
</template>

<style scoped>
.sheet-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 10px;
  border-top: 2px solid var(--teal-soft);
}
.step-count {
  margin-right: auto;
  font-size: 1rem;
  font-weight: 700;
  color: var(--teal);
}
</style>
