<script setup>
// 一步一步的讲解：每点一次“下一步”，天平就按这一步变化，下面写清楚这一步的算式。
// 最后一页给出答案，并把答案放回每架天平检查。例题讲解和练习里的“看讲解”都用它。
import { computed, ref } from 'vue'
import BalanceScale from './BalanceScale.vue'
import EquationLine from './EquationLine.vue'
import { checkWithAnswer, explainPuzzle } from '../core/explain.js'
import { itemLabel } from '../items.js'
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
const steps = explainPuzzle(props.puzzle, props.tools) || []
const lastPage = steps.length + 1
const page = ref(0)
const event = ref(null)

const board = computed(() => {
  if (page.value === 0) return props.puzzle.board
  return steps[Math.min(page.value, steps.length) - 1].board
})

const text = computed(() => {
  if (page.value === 0) {
    const items = props.puzzle.items
    return items.length === 1
      ? t('teach.introOne', { unknowns: itemLabel(items[0]) })
      : words.tt('teach.introTwo', { unknowns: words.unknowns() })
  }
  if (page.value <= steps.length) return words.stepText(steps[page.value - 1])
  return t('teach.answer', { answers: words.answersText(props.puzzle.answer) })
})

const checks = computed(() => (page.value === lastPage ? checkWithAnswer(props.puzzle.board, props.puzzle.answer) : []))
const active = computed(() => (page.value >= 1 && page.value <= steps.length ? steps[page.value - 1].event?.scaleIds || [] : []))

function next() {
  if (page.value >= lastPage) return
  page.value++
  const step = steps[page.value - 1]
  event.value = step?.event ? { ...step.event, key: Date.now() } : null
  play(page.value === lastPage ? 'found' : 'move')
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
  <div class="player">
    <TransitionGroup tag="div" name="card" class="player-scales" :class="`count-${board.scales.length}`">
      <article v-for="scale in board.scales" :key="scale.id" class="scale-card" :class="{ active: active.includes(scale.id) }">
        <span class="scale-tag">{{ scale.combined ? t('scale.combined', { id: scale.id }) : t('scale.name', { id: scale.id }) }}</span>
        <BalanceScale :scale="scale" :items="puzzle.items" :theme="theme" :event="event" />
        <EquationLine :scale="scale" :items="puzzle.items" :theme="theme" />
      </article>
    </TransitionGroup>

    <section class="step-card" aria-live="polite">
      <p class="step-count">{{ t('teach.stepCount', { n: page + 1, total: lastPage + 1 }) }}</p>
      <p class="step-text">{{ text }}</p>
      <div v-if="page === lastPage" class="checks">
        <p class="checks-title">{{ t('teach.check') }}</p>
        <p v-for="row in checks" :key="row.id" class="check-line">
          <span class="check-scale">{{ t('scale.name', { id: row.id }) }}</span>
          <span>{{ words.checkLine(row) }}</span>
        </p>
      </div>
      <div class="step-actions">
        <button type="button" class="btn btn-soft" :disabled="page === 0" @click="prev">← {{ t('teach.prev') }}</button>
        <template v-if="page < lastPage">
          <button type="button" class="btn btn-primary" @click="next">{{ t('teach.next') }} →</button>
        </template>
        <template v-else>
          <button type="button" class="btn btn-soft" @click="replay">↺ {{ t('teach.replay') }}</button>
          <button type="button" class="btn btn-primary" @click="emit('finish')">{{ finishLabel }} ▶</button>
        </template>
      </div>
    </section>
  </div>
</template>

<style scoped>
.player {
  display: grid;
  gap: 14px;
}
.player-scales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 14px;
  align-items: start;
}
.player-scales.count-1 {
  max-width: 460px;
  width: 100%;
  margin-inline: auto;
}
.scale-card {
  display: grid;
  gap: 4px;
  padding: 10px 12px 12px;
  border-radius: var(--radius);
  background: var(--paper);
  border: 3px solid transparent;
  box-shadow: var(--shadow);
  transition: border-color 0.2s;
}
.scale-card.active {
  border-color: var(--sun);
}
.scale-tag {
  justify-self: start;
  padding: 3px 12px;
  border-radius: 10px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.95rem;
}
.step-card {
  display: grid;
  gap: 10px;
  padding: 16px 18px;
  border-radius: var(--radius);
  background: #fff;
  border: 3px solid var(--teal-soft);
  box-shadow: var(--shadow);
}
.step-count {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  color: var(--teal);
  letter-spacing: 0.04em;
}
.step-text {
  margin: 0;
  font-size: clamp(1.25rem, 2.8vw, 1.5rem);
  line-height: 1.6;
  font-weight: 600;
  text-wrap: pretty;
}
.checks {
  display: grid;
  gap: 4px;
  padding: 10px 12px;
  border-radius: 14px;
  background: var(--leaf-soft);
}
.checks-title {
  margin: 0 0 2px;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--leaf);
}
.check-line {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.check-scale {
  color: var(--ink-soft);
  font-weight: 600;
}
.step-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 10px;
}
.card-enter-active {
  animation: card-pop 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.card-leave-active {
  animation: card-pop 0.25s ease-in reverse;
}
@keyframes card-pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
</style>
