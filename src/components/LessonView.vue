<script setup>
// 一节课：先跟老师学一道例题（一步一步演算），再做 5 道练习。
// 练习时孩子自己列步骤：每一步先想做什么——选方法、点天平、写数；这一步能这样做，就写出算式，结果由孩子自己算。
// 不能这样做时只说为什么，不替孩子选；可以擦掉一步换个方法。提示先问下一步怎么想，再说用哪个方法。
// 老师讲解的声音：例题每一页都读（StepPlayer）；练习时读提示、为什么不能这样做、算错了、做对了。
// 题库（bank）：不看例题，直接做题，做完一道点“下一题”一直有新题；每课做了几道记在这台设备上。
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import ConfettiBurst from './ConfettiBurst.vue'
import LessonResult from './LessonResult.vue'
import NumberPad from './NumberPad.vue'
import OwlSays from './OwlSays.vue'
import StepComposer from './StepComposer.vue'
import StepPlayer from './StepPlayer.vue'
import WorkSheet from './WorkSheet.vue'
import WorkTokens from './WorkTokens.vue'
import { buildPuzzle, generateLevel, puzzleStream } from '../core/generator.js'
import { starsFor } from '../core/lessons.js'
import { randomSeed } from '../core/random.js'
import { engineFor, exampleWorking } from '../core/styles.js'
import { t, template } from '../i18n.js'
import { play } from '../sound.js'
import { progress, recordBank, recordLesson } from '../store.js'
import { say, stopVoice, toggleVoice } from '../voice.js'
import { makeWords } from '../words.js'

const props = defineProps({
  lesson: { type: Object, required: true },
  hasNext: { type: Boolean, default: false },
  bank: { type: Boolean, default: false }, // 题库：不看例题，一道接一道做
})
const emit = defineEmits(['home', 'again', 'next'])

const STEP_PAUSE = 1500 // 一步算对以后，停一会儿看天平怎么变，再列下一步

const theme = props.lesson.theme
// 列算式，还是看图算（第 4 课）：练习和例题都按这一课的写法
const engine = engineFor(props.lesson)
const look = props.lesson.style === 'look'
const { items: exItems, values: exValues, clues: exClues } = props.lesson.example
const example = buildPuzzle(props.lesson.template, exValues, exClues, exItems)
const exampleWork = exampleWorking(props.lesson, example)
const exampleWords = makeWords(example.items, theme)
// 课：一组 5 道题；题库：一道接一道出新题
const newProblem = props.bank ? puzzleStream(props.lesson, randomSeed()) : null
const problems = ref(props.bank ? [newProblem()] : generateLevel(props.lesson, randomSeed()))

const phase = ref(props.bank ? 'practice' : 'teach')
const index = ref(0)
const problem = computed(() => problems.value[index.value])
const words = computed(() => makeWords(problem.value.items, theme))
const sheet = computed(() => engine.sheet(problem.value))

// —— 孩子列的步骤 ——
const states = ref([engine.start(problems.value[0])]) // 每写完一步，多一个“现在的样子”
const history = ref([]) // 写完、算对的步骤
const planned = ref(null) // 列好了、正在算结果的这一步
const choice = reactive({ method: null, scale: null, other: null, item: null, number: null })
const gap = ref('scale') // 两架天平的方法：点天平时放进哪个空
const message = ref(null) // 列步骤那里的话：提示，或者为什么不能这样做
const tip = ref(null) // 算结果那一步里的话
const hintLevel = ref(0)
const values = reactive({}) // 这一步已经填对的数
const wrong = reactive({}) // 这一步填错的数（红色，点一下重新填）
const pad = ref(null) // 数字键盘：{ kind: 'number' } 列步骤时写的数；{ kind: 'blank', id } 算结果
const finished = ref(false)
const solved = ref(false)
const mistakes = ref(false)
const helped = ref(false)
const firstTry = ref(0)
const doneCount = ref(0) // 这一次做完了几道
const showExample = ref(false)
const result = ref(null)
const confetti = ref(null)
let pause = 0

const state = computed(() => states.value[states.value.length - 1])
const work = computed(() => ({ ...sheet.value, steps: planned.value ? [...history.value, planned.value] : history.value }))
const lines = computed(() => engine.lines(state.value))
const found = computed(() => engine.found(state.value))
const nextBlank = computed(() => planned.value?.blanks.find((b) => values[b.id] !== b.value)?.id ?? null)
const padBlank = computed(() => (pad.value?.kind === 'blank' ? pad.value.id : null))
const canUndo = computed(() => !solved.value && !finished.value && Boolean(planned.value || history.value.length))
const doneText = computed(() => (!mistakes.value && !helped.value ? t('practice.rightFirst') : t('practice.right')))

const bubble = computed(() => ({
  title: props.bank
    ? t('bank.banner', { n: index.value + 1 })
    : phase.value === 'teach'
      ? t('teach.banner')
      : t('practice.banner', { n: index.value + 1, total: problems.value.length }),
  text: t(`lesson.${props.lesson.id}.idea`),
}))

function clear(map) {
  for (const key of Object.keys(map)) delete map[key]
}

function resetChoice() {
  Object.assign(choice, { method: null, scale: null, other: null, item: null, number: null })
  gap.value = 'scale'
}

function resetProblem() {
  clearTimeout(pause)
  states.value = [engine.start(problem.value)]
  history.value = []
  planned.value = null
  resetChoice()
  clear(values)
  clear(wrong)
  finished.value = false
  solved.value = false
  mistakes.value = false
  helped.value = false
  hintLevel.value = 0
  tip.value = null
  message.value = { text: t(look ? 'compose.startLook' : 'compose.start'), mood: 'think' }
}

async function goPractice() {
  phase.value = 'practice'
  resetProblem()
  window.scrollTo({ top: 0 })
  await nextTick() // 例题收起来（老师停下）以后，再读练习怎么做
  say(message.value.text)
}

// 列步骤那里出了话（提示、为什么不能这样做），滚到看得见“写出来”的地方
async function showMessage() {
  await nextTick()
  const el = document.querySelector('.composer .composer-actions') || document.querySelector('.composer .composer-message')
  el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

// —— 列步骤：选方法、点天平、写数 ——
function chooseMethod(method) {
  play('tap')
  resetChoice()
  choice.method = method
  if (lines.value.length === 1) choice.scale = lines.value[0].scale.id
  // 比一比只有两架天平可比：两架都放上（谁比谁多不用孩子排）
  if (method === 'lookCompare' && lines.value.length === 2) Object.assign(choice, { scale: lines.value[0].scale.id, other: lines.value[1].scale.id })
  if ((method === 'substitute' || method === 'lookSwap') && found.value.length === 1) choice.item = found.value[0].item
  message.value = null
}

function pickScale(id) {
  play('tap')
  if (['subtract', 'add', 'lookCompare'].includes(choice.method)) {
    choice[gap.value] = id
    gap.value = gap.value === 'scale' ? 'other' : 'scale'
  } else {
    choice.scale = id
  }
}

function pickGap(name) {
  gap.value = name
}

function pickItem(item) {
  play('tap')
  choice.item = item
}

function openNumber() {
  play('tap')
  pad.value = { kind: 'number' }
}

// 写出来：能这样做就写进演算纸，不能就说为什么
function confirmStep() {
  const res = engine.plan(state.value, choice)
  if (!res.ok) {
    mistakes.value = true
    message.value = { text: words.value.reasonText(res.reason), mood: 'oops' }
    play('wrong')
    say(message.value.text)
    showMessage()
    return
  }
  play('move')
  planned.value = res.step
  message.value = null
  tip.value = { text: t('compose.compute'), mood: 'think' }
}

// —— 算结果：这一步里变了的数由孩子自己算 ——
function pickBlank(id) {
  if (solved.value || finished.value || !planned.value) return
  const blank = planned.value.blanks.find((b) => b.id === id)
  if (!blank || values[id] === blank.value) return
  play('tap')
  pad.value = { kind: 'blank', id }
}

function enter(value) {
  const target = pad.value
  pad.value = null
  if (value == null || !target) return
  if (target.kind === 'number') {
    choice.number = value
    return
  }
  const blank = planned.value?.blanks.find((b) => b.id === target.id)
  if (!blank) return
  if (value !== blank.value) {
    wrong[blank.id] = value
    mistakes.value = true
    tip.value = { text: t('work.wrong'), mood: 'oops' }
    play('wrong')
    say(tip.value.text)
    return
  }
  values[blank.id] = value
  delete wrong[blank.id]
  const rest = planned.value.blanks.find((b) => values[b.id] !== b.value)
  if (rest) {
    // 这一步还有数要算：键盘接着填下一个
    pad.value = { kind: 'blank', id: rest.id }
    play('tap')
    return
  }
  finishStep()
}

// 这一步算对了：打勾，天平跟着变，停一会儿再列下一步
function finishStep() {
  finished.value = true
  tip.value = engine.solved(planned.value.next) ? null : { text: t('compose.stepRight'), mood: 'happy' }
  play('move')
  clearTimeout(pause)
  pause = setTimeout(commitStep, STEP_PAUSE)
}

function commitStep() {
  const done = planned.value
  history.value = [...history.value, done]
  states.value = [...states.value, done.next]
  planned.value = null
  finished.value = false
  clear(values)
  clear(wrong)
  tip.value = null
  resetChoice()
  hintLevel.value = 0
  if (engine.solved(done.next)) {
    solved.value = true
    message.value = null
    if (!mistakes.value && !helped.value) firstTry.value++
    doneCount.value++
    if (props.bank) recordBank(props.lesson.id, !mistakes.value && !helped.value)
    play('solved')
    say(doneText.value)
    confetti.value?.fire()
    return
  }
  message.value = { text: t('compose.stepDone'), mood: 'happy' }
}

// —— 擦掉一步：正在算的这一步，或者上一步 ——
function undo() {
  if (!canUndo.value) return
  play('tap')
  if (planned.value) {
    planned.value = null
    clear(values)
    clear(wrong)
    tip.value = null
  } else {
    history.value = history.value.slice(0, -1)
    states.value = states.value.slice(0, -1)
    resetChoice()
  }
  message.value = null
  hintLevel.value = 0
}

// —— 提示：列步骤时，第一次问下一步怎么想，第二次说用哪个方法；算结果时只说这个数怎么算 ——
function hint() {
  if (solved.value || finished.value) return
  play('tap')
  helped.value = true
  if (planned.value) {
    const id = Object.keys(wrong)[0] ?? nextBlank.value
    const blank = planned.value.blanks.find((b) => b.id === id)
    if (blank) {
      tip.value = { text: words.value.hintText(planned.value, blank), mood: 'think' }
      say(tip.value.text)
    }
    return
  }
  const next = engine.hint(state.value, props.lesson.methods)
  if (!next) message.value = { text: t('next.stuck'), mood: 'think' }
  else message.value = { text: hintLevel.value === 0 ? words.value.nextThink(next) : words.value.nextDo(next), mood: 'think' }
  hintLevel.value = 1
  say(message.value.text)
  showMessage()
}

function openExample() {
  play('tap')
  showExample.value = true
}

function nextProblem() {
  stopVoice()
  if (props.bank) {
    problems.value = [...problems.value, newProblem()]
    index.value++
    resetProblem()
    play('tap')
    window.scrollTo({ top: 0 })
    return
  }
  if (index.value < problems.value.length - 1) {
    index.value++
    resetProblem()
    play('tap')
    window.scrollTo({ top: 0 })
    return
  }
  const stars = starsFor(firstTry.value, problems.value.length)
  recordLesson(props.lesson.id, stars, firstTry.value)
  result.value = { stars, firstTry: firstTry.value }
  phase.value = 'done'
}

// 题库一进来就是第 1 题：先说练习怎么做
if (props.bank) resetProblem()
onMounted(() => {
  if (props.bank) say(message.value.text)
})

onBeforeUnmount(() => {
  clearTimeout(pause)
  stopVoice()
})

function switchVoice() {
  toggleVoice()
  play('tap')
}

// 键盘上方显示正在写的那一步
function padSentence(typed) {
  return template(`compose.${choice.method}`)
    .replace('{scale}', choice.scale ?? '?')
    .replace('{other}', choice.other ?? '?')
    .replace('{number}', typed === '' ? '?' : typed)
}
const padLine = computed(() => {
  const step = planned.value
  if (!padBlank.value || !step) return null
  for (const line of step.lines) {
    if (line.kind === 'eq' && line.tokens.some((tok) => tok.blank === padBlank.value)) return { tag: line.tag, tokens: line.tokens }
    if (line.kind === 'column') {
      const r = line.result
      if (r.right.blank === padBlank.value || Object.values(r.countBlanks).includes(padBlank.value)) {
        const terms = problem.value.items
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
const eyebrow = computed(() => {
  if (props.bank) return t('bank.eyebrow', { done: doneCount.value, right: firstTry.value })
  return phase.value === 'teach' ? t('top.teach') : t('top.practice', { n: index.value + 1, total: problems.value.length })
})
</script>

<template>
  <div class="lesson">
    <header class="topbar">
      <button type="button" class="btn btn-soft btn-small" @click="emit('home')">
        ← <span class="hide-narrow">{{ bank ? t('top.bank') : t('top.home') }}</span>
      </button>
      <div class="topbar-title">
        <p class="eyebrow">{{ eyebrow }}</p>
        <h1>{{ title }}</h1>
      </div>
      <button
        type="button"
        class="btn btn-soft btn-small voice-toggle"
        :aria-pressed="progress.settings.voice"
        :aria-label="t('settings.voice')"
        :title="progress.settings.voice ? t('voice.on') : t('voice.off')"
        @click="switchVoice"
      >
        {{ progress.settings.voice ? '🔊' : '🔇' }}
      </button>
    </header>

    <OwlSays class="owl-row" :title="bubble.title" :text="bubble.text" mood="think" />

    <!-- 例题：跟着老师一步一步学 -->
    <StepPlayer
      v-if="phase === 'teach'"
      :lesson-id="lesson.id"
      :work="exampleWork"
      :theme="theme"
      :finish-label="t('teach.startPractice')"
      @finish="goPractice"
    />

    <!-- 练习：孩子自己列步骤 -->
    <template v-else>
      <WorkSheet
        :key="`w${index}`"
        :work="work"
        :words="words"
        :theme="theme"
        :title="t('work.titleMine')"
        mode="do"
        :upto="history.length"
        :done="solved"
        :values="values"
        :wrong="wrong"
        :active="padBlank"
        :next="pad || finished ? null : nextBlank"
        :tip="tip"
        :finished="finished"
        :done-text="doneText"
        @pick="pickBlank"
      >
        <template #composer>
          <StepComposer
            v-if="!planned && !solved"
            :step-no="history.length + 1"
            :methods="lesson.methods"
            :lines="lines"
            :found="found"
            :choice="choice"
            :active-gap="gap"
            :items="problem.items"
            :theme="theme"
            :words="words"
            :message="message"
            @method="chooseMethod"
            @scale="pickScale"
            @gap="pickGap"
            @item="pickItem"
            @number="openNumber"
            @confirm="confirmStep"
          />
        </template>
      </WorkSheet>

      <footer class="action-bar">
        <template v-if="!solved">
          <button type="button" class="btn btn-soft" @click="hint">💡 {{ t('practice.hint') }}</button>
          <button type="button" class="btn btn-soft" :disabled="!canUndo" @click="undo">↶ {{ t('practice.undo') }}</button>
          <button type="button" class="btn btn-soft" @click="openExample">📖 {{ t('practice.example') }}</button>
        </template>
        <button v-else type="button" class="btn btn-primary" @click="nextProblem">
          {{ bank || index < problems.length - 1 ? t('practice.next') : t('practice.finish') }} ▶
        </button>
      </footer>
    </template>

    <NumberPad v-if="pad" :key="pad.kind === 'blank' ? `b-${pad.id}` : 'number'" :label="t('work.title')" @done="enter" @close="pad = null">
      <template #display="{ text }">
        <span class="pad-line">
          <template v-if="pad.kind === 'number'">{{ padSentence(text) }}</template>
          <template v-else-if="padLine">
            <span v-if="padLine.tag" class="pad-tag">{{ padLine.tag }}</span>
            <WorkTokens :tokens="padLine.tokens" mode="do" :values="values" :active="padBlank" :typing="text" />
          </template>
        </span>
      </template>
    </NumberPad>

    <!-- 看例题：老师写好的完整演算，照着想 -->
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
.voice-toggle {
  min-width: 44px;
  padding-inline: 8px;
  font-size: 1.2rem;
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
