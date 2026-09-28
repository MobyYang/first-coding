<script setup>
// 演算纸：先写题目（天平和算式），再一步一步往下写。
// 每一步：第几步 + 做什么；例题里再写一句为什么；这一步的天平就画在这一步里，看算式的时候就能看到天平怎么变。
// 前面写过的步骤一直留着，孩子能看出每一步是从哪一行来的。
// show：例题里老师写好的；do：练习时孩子自己列的步骤，正在算的这一步留着空让孩子填，下一步在 composer 里列。
import { computed, nextTick, ref, watch } from 'vue'
import BalanceScale from './BalanceScale.vue'
import ColumnBlock from './ColumnBlock.vue'
import StepScale from './StepScale.vue'
import WorkTokens from './WorkTokens.vue'
import { t } from '../i18n.js'

const props = defineProps({
  work: { type: Object, required: true },
  words: { type: Object, required: true },
  theme: { type: String, default: 'fruit' },
  title: { type: String, required: true },
  mode: { type: String, default: 'show' },
  upto: { type: Number, default: 0 }, // 已经写完的步数
  done: { type: Boolean, default: false },
  scales: { type: Boolean, default: true }, // 画天平（看例题的小窗里不画）
  explainAll: { type: Boolean, default: false }, // 每一步都写为什么（看例题的小窗里）
  values: { type: Object, default: () => ({}) },
  wrong: { type: Object, default: () => ({}) },
  active: { type: String, default: null },
  next: { type: String, default: null },
  tip: { type: Object, default: null }, // 练习时写在当前这一步里的话：提示、填错了……
  finished: { type: Boolean, default: false }, // 练习时当前这一步刚填对：打勾，天平开始变
  doneText: { type: String, default: '' },
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
const showWhy = (i) => props.mode === 'show' && (props.explainAll || i === current.value)
const showScale = (i) => props.scales && i === current.value
const ticked = (i) => props.mode === 'do' && (i < props.upto || (i === current.value && props.finished))

// 新写出来的一步滚到看得见的地方
const root = ref(null)
watch(
  () => [props.upto, props.done, props.work.steps.length],
  async () => {
    await nextTick()
    const el = root.value?.querySelector(props.done ? '.sheet-answer' : '.step.current, .composer')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  },
)
</script>

<template>
  <section ref="root" class="sheet" aria-live="polite">
    <header class="sheet-head">
      <h2 class="sheet-title">{{ title }}</h2>
      <p class="sheet-goal">{{ words.goalText() }}</p>
    </header>

    <!-- 题目 -->
    <div class="problem">
      <p class="problem-label">{{ t('work.problem') }}</p>
      <div v-if="scales" class="problem-scales" :class="{ single: work.board.scales.length === 1 }">
        <figure v-for="scale in work.board.scales" :key="scale.id" class="mini-scale">
          <span class="scale-tag">{{ t('scale.name', { id: scale.id }) }}</span>
          <BalanceScale :scale="scale" :items="work.items" :theme="theme" />
        </figure>
      </div>
      <ul class="problem-lines">
        <li v-for="row in work.given" :key="row.scaleId" class="line">
          <span class="tag">{{ row.scaleId }}</span>
          <WorkTokens :tokens="row.tokens" />
        </li>
      </ul>
    </div>

    <!-- 一步一步 -->
    <ol class="steps">
      <li v-for="(step, i) in shown" :key="i" class="step" :class="{ current: i === current, finished: i === current && finished }">
        <p class="step-title">
          <span class="step-no">{{ t('work.stepNo', { n: i + 1 }) }}</span>
          <span class="step-name">{{ words.titleText(step) }}</span>
          <WorkTokens v-if="step.titleNumber" :tokens="[step.titleNumber]" v-bind="rowProps(i)" @pick="emit('pick', $event)" />
          <span v-if="ticked(i)" class="step-ok" aria-hidden="true">✓</span>
        </p>
        <div class="step-body" :class="{ 'has-scale': showScale(i) }">
          <StepScale
            v-if="showScale(i)"
            :key="`scale-${i}`"
            :step="step"
            :items="work.items"
            :theme="theme"
            :floats="words.floatText(step)"
            :play="mode === 'show' || finished"
          />
          <div class="step-math">
            <p v-if="showWhy(i)" class="step-why">{{ words.whyText(step) }}</p>
            <template v-for="(line, k) in step.lines" :key="k">
              <p v-if="line.kind === 'eq'" class="line">
                <span class="tag">{{ line.tag }}</span>
                <WorkTokens :tokens="line.tokens" v-bind="rowProps(i)" @pick="emit('pick', $event)" />
              </p>
              <ColumnBlock v-else :line="line" :items="work.items" v-bind="rowProps(i)" @pick="emit('pick', $event)" />
            </template>
            <p v-if="i === current && tip" class="step-tip" :class="`mood-${tip.mood}`">🦉 {{ tip.text }}</p>
          </div>
        </div>
      </li>
    </ol>

    <!-- 练习时：孩子自己列下一步 -->
    <slot name="composer" />

    <!-- 答案和检查 -->
    <div v-if="done" class="sheet-answer">
      <p v-if="doneText" class="done-text">{{ doneText }}</p>
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
  gap: 14px;
  align-self: start;
  align-content: start;
  width: 100%;
  max-width: 920px;
  margin-inline: auto;
  padding: 16px 18px;
  border-radius: var(--radius);
  background: #fff;
  border: 3px solid var(--teal-soft);
  box-shadow: var(--shadow);
  box-sizing: border-box;
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
  font-size: 1.3rem;
  color: var(--teal);
}
.sheet-goal {
  margin: 0;
  font-size: clamp(1.15rem, 2.6vw, 1.35rem);
  font-weight: 700;
}
.problem {
  display: grid;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 16px;
  background: var(--paper);
}
.problem-label {
  margin: 0;
  font-weight: 700;
  color: var(--ink-soft);
}
.problem-scales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  width: 100%;
  max-width: 500px;
  margin-inline: auto;
  gap: 10px;
}
.problem-scales.single {
  max-width: 250px;
}
.mini-scale {
  margin: 0;
  display: grid;
  gap: 2px;
  padding: 6px 8px;
  border-radius: 14px;
  background: #fff;
}
.problem-lines {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 4px;
}
.steps {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.step {
  display: grid;
  gap: 6px;
  padding: 8px 10px 10px;
  border-radius: 16px;
  border: 3px solid var(--paper-line);
  scroll-margin: 90px 0 110px; /* 自动滚过来时，别被顶上的标题和底下的按钮挡住 */
  transition: background 0.3s, border-color 0.3s;
}
.step.current {
  background: #fff8dc;
  border-color: var(--sun);
  animation: step-in 0.35s ease-out;
}
.step.finished {
  background: var(--leaf-soft);
  border-color: var(--leaf);
}
.step-title {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: clamp(1.1rem, 2.6vw, 1.3rem);
  font-weight: 700;
}
.step-no {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--teal);
  color: #fff;
  font-size: 0.85em;
}
.step-name {
  color: var(--teal);
}
.step-ok {
  color: var(--leaf);
  font-size: 1.2em;
}
.step-body {
  display: grid;
  gap: 10px;
  align-items: start;
}
.step-body.has-scale .step-scale {
  width: min(320px, 100%);
  justify-self: center;
}
@media (min-width: 760px) {
  .step-body.has-scale {
    grid-template-columns: minmax(240px, 300px) minmax(0, 1fr);
  }
}
.step-math {
  display: grid;
  gap: 6px;
  min-width: 0;
  align-content: start;
}
.step-why {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff;
  border-left: 5px solid var(--teal);
  font-size: clamp(1.05rem, 2.4vw, 1.2rem);
  font-weight: 600;
  line-height: 1.55;
}
.line {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: clamp(1.25rem, 3vw, 1.55rem);
  font-weight: 600;
}
.tag,
.scale-tag {
  flex: none;
  display: inline-grid;
  place-items: center;
  justify-self: start;
  min-width: 1.9rem;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--brass-light);
  color: #6b4a06;
  font-size: 0.95rem;
  font-weight: 700;
}
.step-tip {
  margin: 0;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff;
  font-size: clamp(1.05rem, 2.4vw, 1.2rem);
  font-weight: 700;
  color: var(--teal);
}
.step-tip.mood-oops {
  color: var(--berry);
}
.step-tip.mood-happy {
  color: var(--leaf);
}
.sheet-answer {
  display: grid;
  gap: 8px;
  scroll-margin: 90px 0 110px;
}
.done-text {
  margin: 0;
  font-size: clamp(1.25rem, 3vw, 1.5rem);
  font-weight: 700;
  color: var(--coral-dark);
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
