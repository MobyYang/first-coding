<script setup>
// 一节课：先跟老师学一道例题（一步一步演算），再照着例题做 5 道练习。
// 练习也是一步一步演算：每一步的标题和算式都写好了，要算的数空着，孩子自己填。
// 一步填对了，这一步的天平跟着变，再写下一步；最后一步算出来的就是答案。
import { computed, onBeforeUnmount, reactive, ref } from 'vue'
import ConfettiBurst from './ConfettiBurst.vue'
import LessonResult from './LessonResult.vue'
import NumberPad from './NumberPad.vue'
import OwlSays from './OwlSays.vue'
import StepPlayer from './StepPlayer.vue'
import WorkSheet from './WorkSheet.vue'
import WorkTokens from './WorkTokens.vue'
import { buildPuzzle, generateLevel } from '../core/generator.js'
import { starsFor } from '../core/lessons.js'
import { randomSeed } from '../core/random.js'
import { buildWorking } from '../core/working.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { recordLesson } from '../store.js'
import { makeWords } from '../words.js'

const props = defineProps({
  lesson: { type: Object, required: true },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['home', 'again', 'next'])

const STEP_PAUSE = 1500 // 一步填对以后，停一会儿看天平怎么变，再写下一步

const theme = props.lesson.theme
const { items: exItems, values: exValues, clues: exClues } = props.lesson.example
const example = buildPuzzle(props.lesson.template, exValues, exClues, exItems)
const exampleWork = buildWorking(example, props.lesson.tools)
const exampleWords = makeWords(example.items, theme)
const problems = generateLevel(props.lesson, randomSeed())

const phase = ref('teach')
const index = ref(0)
const problem = computed(() => problems[index.value])
const work = computed(() => buildWorking(problem.value, props.lesson.tools))
const words = computed(() => makeWords(problem.value.items, theme))

// —— 这道题做到哪儿了 ——
const stepIndex = ref(0)
const values = reactive({}) // 这一步已经填对的空
const wrong = reactive({}) // 这一步填错的空（红色，点一下重新填）
const padBlank = ref(null)
const finished = ref(false) // 这一步刚填对，正在看天平变
const solved = ref(false)
const mistakes = ref(false)
const helped = ref(false)
const firstTry = ref(0)
const tip = ref(null)
const showExample = ref(false)
const result = ref(null)
const confetti = ref(null)
let pause = 0

const step = computed(() => work.value.steps[stepIndex.value] || null)
const nextBlank = computed(() => step.value?.blanks.find((b) => values[b.id] !== b.value)?.id ?? null)

const bubble = computed(() => ({
  title: phase.value === 'teach' ? t('teach.banner') : t('practice.banner', { n: index.value + 1, total: problems.length }),
  text: t(`lesson.${props.lesson.id}.idea`),
}))

function say(key, mood = 'think') {
  tip.value = { text: t(key), mood }
}

function clear(map) {
  for (const key of Object.keys(map)) delete map[key]
}

function startPractice() {
  phase.value = 'practice'
  say('work.start')
  window.scrollTo({ top: 0 })
}

// —— 填空 ——
function pick(id) {
  if (solved.value || finished.value || !step.value) return
  const blank = step.value.blanks.find((b) => b.id === id)
  if (!blank || values[id] === blank.value) return
  play('tap')
  padBlank.value = id
}

function enter(value) {
  const blank = step.value?.blanks.find((b) => b.id === padBlank.value)
  if (!blank || value == null) {
    padBlank.value = null
    return
  }
  if (value !== blank.value) {
    wrong[blank.id] = value
    mistakes.value = true
    padBlank.value = null
    say('work.wrong', 'oops')
    play('wrong')
    return
  }
  values[blank.id] = value
  delete wrong[blank.id]
  const rest = step.value.blanks.find((b) => values[b.id] !== b.value)
  if (rest) {
    // 这一步还有空：键盘接着填下一个
    padBlank.value = rest.id
    play('tap')
    return
  }
  padBlank.value = null
  finishStep()
}

// 这一步都填对了：打勾，天平跟着变，停一会儿再写下一步
function finishStep() {
  finished.value = true
  say('work.right', 'happy')
  play('move')
  clearTimeout(pause)
  pause = setTimeout(nextStep, STEP_PAUSE)
}

function nextStep() {
  finished.value = false
  stepIndex.value++
  clear(values)
  clear(wrong)
  tip.value = null
  if (stepIndex.value < work.value.steps.length) return
  solved.value = true
  const first = !mistakes.value && !helped.value
  if (first) firstTry.value++
  play('solved')
  confetti.value?.fire()
}

// —— 提示：只说这一个空怎么想（用过就不算“一次做对”） ——
function hint() {
  if (!step.value || finished.value) return
  const id = Object.keys(wrong)[0] ?? nextBlank.value
  const blank = step.value.blanks.find((b) => b.id === id)
  if (!blank) return
  play('tap')
  helped.value = true
  tip.value = { text: words.value.hintText(step.value, blank), mood: 'think' }
}

function openExample() {
  play('tap')
  showExample.value = true
}

function nextProblem() {
  if (index.value < problems.length - 1) {
    index.value++
    stepIndex.value = 0
    clear(values)
    clear(wrong)
    finished.value = false
    solved.value = false
    mistakes.value = false
    helped.value = false
    say('work.start')
    play('tap')
    window.scrollTo({ top: 0 })
    return
  }
  const stars = starsFor(firstTry.value, problems.length)
  recordLesson(props.lesson.id, stars, firstTry.value)
  result.value = { stars, firstTry: firstTry.value }
  phase.value = 'done'
}

onBeforeUnmount(() => clearTimeout(pause))

const doneText = computed(() => (!mistakes.value && !helped.value ? t('practice.rightFirst') : t('practice.right')))

// 键盘上方显示正在填的那一行
const padLine = computed(() => {
  if (!padBlank.value || !step.value) return null
  if (step.value.titleNumber?.blank === padBlank.value) {
    return { label: words.value.titleText(step.value), tokens: [step.value.titleNumber] }
  }
  for (const line of step.value.lines) {
    if (line.kind === 'eq' && line.tokens.some((tok) => tok.blank === padBlank.value)) return { tag: line.tag, tokens: line.tokens }
    if (line.kind === 'column') {
      const r = line.result
      if (r.right.blank === padBlank.value || Object.values(r.countBlanks).includes(padBlank.value)) {
        const terms = work.value.items
          .filter((item) => r.counts[item])
          .map((item) => ({ type: 'item', item, count: r.counts[item], blank: r.countBlanks[item] }))
        const tokens = terms.flatMap((tok, k) => (k > 0 ? [{ type: 'op', text: '+' }, tok] : [tok]))
        return { tag: r.tag, tokens: [...tokens, { type: 'op', text: '=' }, r.right] }
      }
    }
  }
  return null
})

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

    <OwlSays class="owl-row" :title="bubble.title" :text="bubble.text" mood="think" />

    <!-- 例题：跟着老师一步一步学 -->
    <StepPlayer
      v-if="phase === 'teach'"
      :puzzle="example"
      :tools="lesson.tools"
      :theme="theme"
      :finish-label="t('teach.startPractice')"
      @finish="startPractice"
    />

    <!-- 练习：照着例题一步一步演算 -->
    <template v-else>
      <WorkSheet
        :key="`w${index}`"
        :work="work"
        :words="words"
        :theme="theme"
        :title="t('work.titleMine')"
        mode="do"
        :upto="stepIndex"
        :done="solved"
        :values="values"
        :wrong="wrong"
        :active="padBlank"
        :next="padBlank || finished ? null : nextBlank"
        :tip="tip"
        :finished="finished"
        :done-text="doneText"
        @pick="pick"
      />

      <footer class="action-bar">
        <template v-if="!solved">
          <button type="button" class="btn btn-soft" @click="hint">💡 {{ t('practice.hint') }}</button>
          <button type="button" class="btn btn-soft" @click="openExample">📖 {{ t('practice.example') }}</button>
        </template>
        <button v-else type="button" class="btn btn-primary" @click="nextProblem">
          {{ index < problems.length - 1 ? t('practice.next') : t('practice.finish') }} ▶
        </button>
      </footer>
    </template>

    <NumberPad v-if="padBlank && padLine" :key="`${stepIndex}-${padBlank}`" :label="t('work.title')" @done="enter" @close="padBlank = null">
      <template #display="{ text }">
        <span class="pad-line">
          <span v-if="padLine.label" class="pad-label">{{ padLine.label }}</span>
          <span v-else class="pad-tag">{{ padLine.tag }}</span>
          <WorkTokens :tokens="padLine.tokens" mode="do" :values="values" :active="padBlank" :typing="text" />
        </span>
      </template>
    </NumberPad>

    <!-- 看例题：老师写好的完整演算，照着做 -->
    <div v-if="showExample" class="example-backdrop" @click.self="showExample = false">
      <div class="example-sheet" role="dialog" aria-modal="true" :aria-label="t('practice.example')">
        <WorkSheet
          :work="exampleWork"
          :words="exampleWords"
          :theme="theme"
          :title="t('work.titleExample')"
          :upto="exampleWork.steps.length"
          :done="true"
          :scales="false"
          explain-all
        >
          <div class="example-actions">
            <button type="button" class="btn btn-primary" @click="showExample = false">{{ t('practice.back') }} ▶</button>
          </div>
        </WorkSheet>
      </div>
    </div>

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
  align-content: start;
  gap: 12px;
  min-height: 100vh;
  min-height: 100dvh;
}
.topbar-spacer {
  width: 44px;
}
.action-bar {
  position: sticky;
  bottom: 0;
  z-index: 5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 10px;
  margin-inline: -16px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 253, 246, 0.95);
  backdrop-filter: blur(6px);
  border-top: 3px solid var(--paper-line);
}
.pad-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 6px 10px;
  font-size: 1.5rem;
}
.pad-label {
  font-size: 1.2rem;
  color: var(--teal);
}
.pad-tag {
  padding: 2px 8px;
  border-radius: 8px;
  background: var(--brass-light);
  color: #6b4a06;
  font-size: 0.95rem;
}
.example-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(29, 47, 79, 0.35);
  animation: fade-in 0.15s ease-out;
}
.example-sheet {
  width: min(760px, 100%);
  max-height: calc(100dvh - 32px);
  overflow-y: auto;
  border-radius: var(--radius);
}
.example-actions {
  display: flex;
  justify-content: flex-end;
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
