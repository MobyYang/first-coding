<script setup>
// 一节课：先看讲解（一道例题一步一步来），再做 5 道练习。
// 练习只有一个问题：每样东西等于几？孩子直接填答案，点“检查”。
import { computed, reactive, ref } from 'vue'
import BalanceScale from './BalanceScale.vue'
import ConfettiBurst from './ConfettiBurst.vue'
import EquationLine from './EquationLine.vue'
import LessonResult from './LessonResult.vue'
import NumberPad from './NumberPad.vue'
import OwlSays from './OwlSays.vue'
import StepPlayer from './StepPlayer.vue'
import { buildPuzzle, generateLevel } from '../core/generator.js'
import { starsFor } from '../core/lessons.js'
import { randomSeed } from '../core/random.js'
import { planSolution } from '../core/solver.js'
import { ITEMS, itemLabel } from '../items.js'
import { lang, t } from '../i18n.js'
import { play } from '../sound.js'
import { recordLesson } from '../store.js'
import { makeWords } from '../words.js'

const props = defineProps({
  lesson: { type: Object, required: true },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['home', 'again', 'next'])

const theme = props.lesson.theme
const { items: exItems, values: exValues, clues: exClues } = props.lesson.example
const example = buildPuzzle(props.lesson.template, exValues, exClues, exItems)
const problems = generateLevel(props.lesson, randomSeed())

const phase = ref('teach')
const index = ref(0)
const problem = computed(() => problems[index.value])
const words = computed(() => makeWords(problem.value.items, theme))

const answers = reactive({})
const marks = ref(null)
const weighValues = ref(null)
const solved = ref(false)
const tried = ref(false)
const helped = ref(false)
const hintLevel = ref(0)
const showSteps = ref(false)
const message = ref({ key: 'practice.ask', mood: 'think' })
const padItem = ref(null)
const firstTry = ref(0)
const result = ref(null)
const confetti = ref(null)

const bubble = computed(() => {
  if (phase.value === 'teach') return { text: t(`lesson.${props.lesson.id}.idea`), mood: 'think' }
  if (hintLevel.value === 1) {
    const plan = planSolution(problem.value.board, props.lesson.tools)
    return { text: plan?.length ? words.value.thinkText(problem.value.board, plan[0]) : t('hint.more'), mood: 'think' }
  }
  if (hintLevel.value === 2) return { text: t('hint.more'), mood: 'think' }
  return { text: t(message.value.key), mood: message.value.mood }
})

function say(key, mood = 'think') {
  hintLevel.value = 0
  message.value = { key, mood }
}

function startPractice() {
  phase.value = 'practice'
  say('practice.ask')
  window.scrollTo({ top: 0 })
}

// —— 填答案 ——
function openPad(item) {
  if (solved.value) return
  play('tap')
  padItem.value = item
}

function setAnswer(value) {
  const item = padItem.value
  padItem.value = null
  if (value == null) delete answers[item]
  else answers[item] = value
  if (marks.value) {
    marks.value = null
    weighValues.value = null
    say('practice.edit')
  }
}

function check() {
  const items = problem.value.items
  if (items.some((item) => answers[item] == null)) {
    say('practice.fill')
    play('wrong')
    return
  }
  const result = Object.fromEntries(items.map((item) => [item, answers[item] === problem.value.answer[item]]))
  marks.value = result
  weighValues.value = { ...answers }
  if (items.every((item) => result[item])) {
    const first = !tried.value && !helped.value
    if (first) firstTry.value++
    solved.value = true
    say(first ? 'practice.rightFirst' : 'practice.right', 'happy')
    play('solved')
    confetti.value?.fire()
  } else {
    say('practice.wrong', 'oops')
    play('wrong')
  }
  tried.value = true
}

// —— 提示和讲解（用过就不算“第一次答对”） ——
function hint() {
  play('tap')
  helped.value = true
  hintLevel.value = hintLevel.value === 0 ? 1 : 2
}

function openSteps() {
  play('tap')
  helped.value = true
  say('practice.steps')
  showSteps.value = true
}

function closeSteps() {
  showSteps.value = false
  say('practice.backNote')
}

function nextProblem() {
  if (index.value < problems.length - 1) {
    index.value++
    for (const key of Object.keys(answers)) delete answers[key]
    marks.value = null
    weighValues.value = null
    solved.value = false
    tried.value = false
    helped.value = false
    showSteps.value = false
    say('practice.ask')
    play('tap')
    window.scrollTo({ top: 0 })
    return
  }
  const stars = starsFor(firstTry.value, problems.length)
  recordLesson(props.lesson.id, stars, firstTry.value)
  result.value = { stars, firstTry: firstTry.value }
  phase.value = 'done'
}

const title = computed(() => `${t('home.lesson', { n: props.lesson.id })} · ${t(`lesson.${props.lesson.id}.title`)}`)
const eyebrow = computed(() =>
  phase.value === 'teach' ? t('top.teach') : t('top.practice', { n: index.value + 1, total: problems.length }),
)
</script>

<template>
  <div class="lesson">
    <header class="topbar">
      <button type="button" class="btn btn-soft btn-small" @click="emit('home')">
        ← <span class="hide-narrow">{{ t('top.home') }}</span>
      </button>
      <div class="topbar-title">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
      <span class="topbar-spacer" aria-hidden="true"></span>
    </header>

    <OwlSays class="owl-row" :text="bubble.text" :mood="bubble.mood" />

    <!-- 讲解 -->
    <StepPlayer
      v-if="phase === 'teach'"
      :puzzle="example"
      :tools="lesson.tools"
      :theme="theme"
      :finish-label="t('teach.startPractice')"
      @finish="startPractice"
    />

    <!-- 练习 -->
    <template v-else-if="phase === 'practice' || phase === 'done'">
      <StepPlayer
        v-if="showSteps"
        :key="`steps-${index}`"
        :puzzle="problem"
        :tools="lesson.tools"
        :theme="theme"
        :finish-label="t('practice.back')"
        @finish="closeSteps"
      />
      <template v-else>
        <TransitionGroup tag="section" name="card" appear class="board" :class="`count-${problem.board.scales.length}`">
          <article v-for="scale in problem.board.scales" :key="`${index}-${scale.id}`" class="scale-card">
            <span class="scale-tag">{{ t('scale.name', { id: scale.id }) }}</span>
            <BalanceScale :scale="scale" :items="problem.items" :theme="theme" :values="weighValues" />
            <EquationLine :scale="scale" :items="problem.items" :theme="theme" />
          </article>
        </TransitionGroup>

        <footer class="answer-bar">
          <div class="answers">
            <span class="answers-title">{{ t('practice.answer') }}</span>
            <button
              v-for="item in problem.items"
              :key="`${index}-${item}`"
              type="button"
              class="answer"
              :class="{ empty: answers[item] == null, right: marks && marks[item], wrong: marks && !marks[item] }"
              :disabled="solved"
              :aria-label="`${ITEMS[item][lang()]} = ${answers[item] ?? '?'}`"
              @click="openPad(item)"
            >
              <span class="answer-item" :class="{ letter: ITEMS[item].letter }" :style="ITEMS[item].letter ? { color: ITEMS[item].color } : null">{{ itemLabel(item) }}</span>
              <span class="answer-eq">=</span>
              <span class="answer-value">{{ answers[item] ?? '?' }}</span>
              <span v-if="marks" class="answer-mark" aria-hidden="true">{{ marks[item] ? '✓' : '✗' }}</span>
            </button>
          </div>
          <div class="answer-actions">
            <template v-if="!solved">
              <button type="button" class="btn btn-soft" @click="hint">💡 {{ t('practice.hint') }}</button>
              <button type="button" class="btn btn-soft" @click="openSteps">📖 {{ t('practice.explain') }}</button>
              <button type="button" class="btn btn-primary" @click="check">{{ t('practice.check') }}</button>
            </template>
            <button v-else type="button" class="btn btn-primary" @click="nextProblem">
              {{ index < problems.length - 1 ? t('practice.next') : t('practice.finish') }} ▶
            </button>
          </div>
        </footer>
      </template>
    </template>

    <NumberPad
      v-if="padItem"
      :label="itemLabel(padItem)"
      :letter="Boolean(ITEMS[padItem].letter)"
      :initial="answers[padItem] ?? null"
      @done="setAnswer"
      @close="padItem = null"
    />
    <LessonResult
      v-if="phase === 'done' && result"
      :lesson="lesson"
      :stars="result.stars"
      :first-try="result.firstTry"
      :total="problems.length"
      :has-next="hasNext"
      @again="emit('again')"
      @next="emit('next')"
      @home="emit('home')"
    />
    <ConfettiBurst ref="confetti" />
  </div>
</template>

<style scoped>
.lesson {
  display: grid;
  grid-template-rows: auto auto 1fr auto;
  gap: 12px;
  min-height: 100vh;
  min-height: 100dvh;
}
.topbar-spacer {
  width: 44px;
}
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 280px), 1fr));
  gap: 14px;
  align-items: start;
}
.board.count-1 {
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
  box-shadow: var(--shadow);
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
.answer-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  margin-inline: -16px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 253, 246, 0.95);
  backdrop-filter: blur(6px);
  border-top: 3px solid var(--paper-line);
}
.answers {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.answers-title {
  font-weight: 700;
  color: var(--ink-soft);
}
.answer {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 56px;
  padding: 6px 16px;
  border-radius: 16px;
  border: 3px solid var(--teal);
  background: #fff;
  color: var(--teal);
  font: inherit;
  font-size: 1.5rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.answer.empty {
  border-style: dashed;
  color: var(--ink-soft);
}
.answer.right {
  border-color: var(--leaf);
  background: var(--leaf-soft);
  color: var(--leaf);
}
.answer.wrong {
  border-color: var(--berry);
  background: var(--berry-soft);
  color: var(--berry);
}
.answer:disabled {
  cursor: default;
}
.answer-item {
  font-family: var(--emoji);
}
.answer-item.letter {
  font-family: var(--font);
  font-style: italic;
}
.answer-eq {
  color: var(--ink-soft);
}
.answer-mark {
  font-size: 1.1rem;
}
.answer-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-left: auto;
}
.card-enter-active {
  animation: card-pop 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
}
@keyframes card-pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
</style>
