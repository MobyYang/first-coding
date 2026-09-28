<script setup>
// 演算纸：先写题目里的算式，再一步一步往下写。每一步两行：“做什么”和新的算式。
// 前面的步骤一直留着，孩子能看到每一步是从哪里来的。
// show：讲解时老师写好的；do：练习时当前这一步留着空，让孩子填。
import { computed, nextTick, ref, watch } from 'vue'
import WorkTokens from './WorkTokens.vue'
import { t } from '../i18n.js'

const props = defineProps({
  work: { type: Object, required: true },
  words: { type: Object, required: true },
  mode: { type: String, default: 'show' },
  upto: { type: Number, default: 0 }, // 已经写完的步数
  done: { type: Boolean, default: false },
  values: { type: Object, default: () => ({}) },
  wrong: { type: Object, default: () => ({}) },
  active: { type: String, default: null },
  next: { type: String, default: null },
})
const emit = defineEmits(['pick'])

const doing = computed(() => props.mode === 'do' && !props.done && props.upto < props.work.steps.length)
const shown = computed(() => props.work.steps.slice(0, props.upto + (doing.value ? 1 : 0)))
const current = computed(() => {
  if (props.done) return -1
  return doing.value ? props.upto : props.upto - 1
})

function rowProps(i) {
  if (!doing.value || i !== props.upto) return { mode: 'show' }
  return { mode: 'do', values: props.values, wrong: props.wrong, active: props.active, next: props.next }
}

// 新写出来的一步滚到看得见的地方
const list = ref(null)
watch(
  () => [props.upto, props.done],
  async () => {
    await nextTick()
    const el = list.value?.querySelector('.step.current') || (props.done ? list.value?.parentElement?.querySelector('.sheet-answer') : null)
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<template>
  <section class="sheet" aria-live="polite">
    <header class="sheet-head">
      <h2 class="sheet-title">✏️ {{ t('work.title') }}</h2>
      <p class="sheet-goal">{{ words.goalText() }}</p>
    </header>

    <ol ref="list" class="sheet-lines">
      <li v-for="row in work.given" :key="`g-${row.scaleId}`" class="given">
        <p class="line">
          <span class="tag">{{ row.scaleId }}</span>
          <WorkTokens :tokens="row.tokens" />
        </p>
      </li>
      <li v-for="(step, i) in shown" :key="`s-${i}`" class="step" :class="{ current: i === current }">
        <p class="label">
          <span class="arrow" aria-hidden="true">↓</span>
          <span>{{ words.labelText(step) }}</span>
          <WorkTokens v-if="step.labelNumber" :tokens="[step.labelNumber]" v-bind="rowProps(i)" @pick="emit('pick', $event)" />
        </p>
        <p class="line">
          <span class="tag">{{ step.scaleId }}</span>
          <WorkTokens :tokens="step.line" v-bind="rowProps(i)" @pick="emit('pick', $event)" />
        </p>
      </li>
    </ol>

    <div v-if="done" class="sheet-answer">
      <p class="answer">{{ t('work.answer', { answers: words.answersText(work.answer) }) }}</p>
      <div class="checks">
        <p class="checks-title">{{ t('teach.check') }}</p>
        <p v-for="row in work.checks" :key="row.id" class="check-line">
          <span class="tag">{{ row.id }}</span>
          <span>{{ words.checkLine(row) }}</span>
        </p>
      </div>
    </div>

    <slot />
  </section>
</template>

<style scoped>
.sheet {
  display: grid;
  gap: 12px;
  padding: 16px 18px;
  border-radius: var(--radius);
  background: #fff;
  border: 3px solid var(--teal-soft);
  box-shadow: var(--shadow);
}
.sheet-head {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 4px 14px;
}
.sheet-title {
  margin: 0;
  font-size: 1.25rem;
  color: var(--teal);
}
.sheet-goal {
  margin: 0;
  font-size: clamp(1.15rem, 2.6vw, 1.35rem);
  font-weight: 700;
}
.sheet-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.given {
  padding: 4px 8px;
  margin-inline: -8px;
  border-radius: 12px;
  background: var(--paper);
}
.step {
  display: grid;
  gap: 4px;
  padding: 4px 8px 6px;
  margin-inline: -8px;
  border-radius: 14px;
  border: 3px solid transparent;
  transition: background 0.3s, border-color 0.3s;
}
.step,
.sheet-answer {
  scroll-margin: 90px 0 110px; /* 自动滚过来时，别被顶上的标题和底下的按钮挡住 */
}
.step.current {
  background: #fff8dc;
  border-color: var(--sun);
  animation: step-in 0.35s ease-out;
}
.line {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(1.3rem, 3.2vw, 1.65rem);
  font-weight: 600;
}
.label {
  margin: 0;
  padding-left: 0.3em;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-size: clamp(1.1rem, 2.6vw, 1.3rem);
  font-weight: 700;
  color: var(--teal);
}
.arrow {
  font-size: 1.2em;
}
.tag {
  flex: none;
  display: inline-grid;
  place-items: center;
  min-width: 1.9rem;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--brass-light);
  color: #6b4a06;
  font-size: 0.95rem;
  font-weight: 700;
}
.sheet-answer {
  display: grid;
  gap: 8px;
}
.answer {
  margin: 0;
  font-size: clamp(1.35rem, 3.2vw, 1.7rem);
  font-weight: 700;
  color: var(--leaf);
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
  align-items: center;
  gap: 4px 12px;
  font-size: 1.3rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
@keyframes step-in {
  from {
    opacity: 0;
    transform: translateY(-6px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .step.current {
    animation: none;
  }
}
</style>
