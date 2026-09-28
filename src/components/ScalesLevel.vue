<script setup>
// 天平关卡：几架平衡的天平（线索）+ 侦探道具 + 侦探笔记 + 称一称
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import BalanceScale from './BalanceScale.vue'
import ConfettiBurst from './ConfettiBurst.vue'
import EquationLine from './EquationLine.vue'
import LevelResult from './LevelResult.vue'
import NumberPad from './NumberPad.vue'
import OwlSays from './OwlSays.vue'
import { generateLevel } from '../core/generator.js'
import { starsFor } from '../core/levels.js'
import { randomSeed } from '../core/random.js'
import {
  MAX_SCALES,
  applyMove,
  canCombine,
  canRemove,
  discovered,
  discoveredValues,
  getScale,
  isSolved,
  shareFactor,
  swapTimes,
  weighAll,
} from '../core/scale.js'
import { planSolution } from '../core/solver.js'
import { ITEMS, itemLabel } from '../items.js'
import { lang, t } from '../i18n.js'
import { play } from '../sound.js'
import { recordLevel } from '../store.js'

const props = defineProps({
  level: { type: Object, required: true },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['exit', 'again', 'next'])

const tools = props.level.tools
const theme = props.level.theme
const showMath = theme === 'letters'

const puzzles = generateLevel(props.level, randomSeed())
const index = ref(0)
const puzzle = computed(() => puzzles[index.value])
const board = ref(puzzle.value.board)
const history = ref([])
const guesses = reactive({})
const weighValues = ref(null)
const pending = ref(null)
const hint = ref(null)
const penalty = ref(0)
const event = ref(null)
const message = ref({ key: `level.${props.level.id}.intro`, params: {}, mood: 'think' })
const phase = ref('play')
const padItem = ref(null)
const result = ref(null)
const stuck = ref(false)
const confetti = ref(null)
let timers = []

const guided = computed(() => Boolean(props.level.tutorial) && index.value === 0)
const items = computed(() => board.value.items)
const found = computed(() => discoveredValues(board.value))

function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
onMounted(() => {
  if (guided.value) later(showGuide, 2600)
})
onBeforeUnmount(clearTimers)

function say(key, params = {}, mood = 'think') {
  message.value = { key, params, mood }
}

// —— 提示 ——
function sameMove(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

function hintText(move) {
  const b = board.value
  const p = pending.value
  let text = ''
  if (move.type === 'takeAway') {
    const s = getScale(b, move.scaleId)
    text = t('hint.takeAway', { id: s.id, v: s.blocks[move.index ?? 0] })
  } else if (move.type === 'share') {
    const s = getScale(b, move.scaleId)
    text = t('hint.share', { id: s.id, n: shareFactor(s) })
  } else if (move.type === 'swap') {
    const src = getScale(b, move.sourceId)
    const d = discovered(src)
    if (p?.type === 'swap' && p.id === move.sourceId) text = t('hint.swapTarget', { dst: move.targetId })
    else if (d) text = t('hint.swapKnown', { item: itemLabel(d.item), v: d.value, src: src.id, dst: move.targetId })
    else text = t('hint.swapBundle', { src: src.id, dst: move.targetId, v: src.right })
  } else if (move.type === 'combine') {
    text =
      p?.type === 'combine' && p.id === move.aId
        ? t('hint.combineTarget', { b: move.bId })
        : t('hint.combine', { a: move.aId, b: move.bId })
  } else if (move.type === 'remove') {
    text = t('hint.remove', { id: move.scaleId })
  }
  return hint.value?.pressed ? `${text} ${t('hint.again')}` : text
}

const bubble = computed(() => {
  if (hint.value && phase.value === 'play') return { text: hintText(hint.value.move), mood: 'think' }
  return { text: t(message.value.key, message.value.params), mood: message.value.mood }
})

// 提示要让哪架天平上的哪个按钮闪
const focus = computed(() => {
  const move = hint.value?.move
  const p = pending.value
  if (!move || phase.value !== 'play') return {}
  if (move.type === 'share') return { [move.scaleId]: 'share' }
  if (move.type === 'takeAway') return { [move.scaleId]: 'take' }
  if (move.type === 'remove') return { [move.scaleId]: 'remove' }
  if (move.type === 'swap') {
    return p?.type === 'swap' && p.id === move.sourceId ? { [move.targetId]: 'swapHere' } : { [move.sourceId]: 'swap' }
  }
  if (move.type === 'combine') {
    return p?.type === 'combine' && p.id === move.aId ? { [move.bId]: 'combineHere' } : { [move.aId]: 'combine' }
  }
  return {}
})

function showGuide() {
  if (phase.value !== 'play') return
  const plan = planSolution(board.value, tools)
  hint.value = plan && plan.length ? { move: plan[0], pressed: false } : null
}

function onHint() {
  if (phase.value !== 'play') return
  play('tap')
  const plan = planSolution(board.value, tools)
  if (!plan || !plan.length) {
    hint.value = null
    stuck.value = true
    say('hint.stuck', {}, 'oops')
    return
  }
  const move = plan[0]
  if (hint.value?.pressed && sameMove(hint.value.move, move)) {
    // 第二次点提示：帮孩子做这一步
    if (!guided.value) penalty.value++
    hint.value = null
    pending.value = null
    say('hint.auto', {}, 'happy')
    const snapshot = board.value
    later(() => {
      if (board.value === snapshot) commit(move)
    }, 700)
    return
  }
  if (!guided.value) penalty.value++
  const keepPending = pending.value && pending.value.type === move.type && pending.value.id === (move.sourceId ?? move.aId)
  if (!keepPending) pending.value = null
  hint.value = { move, pressed: true }
}

// —— 道具 ——
function describe(move, before, next) {
  const key = Date.now()
  if (move.type === 'share') {
    return { kind: 'share', factor: shareFactor(getScale(before, move.scaleId)), scaleIds: [move.scaleId], key }
  }
  if (move.type === 'takeAway') {
    const amount = getScale(before, move.scaleId).blocks[move.index ?? 0]
    return { kind: 'takeAway', amount, scaleIds: [move.scaleId], key }
  }
  if (move.type === 'swap') return { kind: 'swap', scaleIds: [move.targetId], key }
  if (move.type === 'combine') return { kind: 'combine', scaleIds: [next.scales[next.scales.length - 1].id], key }
  return { kind: move.type, scaleIds: [], key }
}

function commit(move) {
  const before = board.value
  const next = applyMove(before, move)
  if (!next) return
  clearTimers()
  const beforeFound = discoveredValues(before)
  history.value.push(before)
  board.value = next
  pending.value = null
  hint.value = null
  stuck.value = false
  weighValues.value = null
  event.value = describe(move, before, next)

  const nowFound = discoveredValues(next)
  const newItem = next.items.find((item) => nowFound[item] !== undefined && beforeFound[item] === undefined)
  if (newItem !== undefined) {
    say('msg.found', { item: itemLabel(newItem), v: nowFound[newItem] }, 'wow')
    play('found')
  } else {
    const e = event.value
    if (move.type === 'share') say('msg.shared', { n: e.factor }, 'happy')
    else if (move.type === 'takeAway') say('msg.took', { v: e.amount }, 'happy')
    else if (move.type === 'swap') say('msg.swapped', {}, 'happy')
    else if (move.type === 'combine') say('msg.combined', { id: e.scaleIds[0] }, 'wow')
    else say('msg.removed', {}, 'think')
    play('move')
  }
  if (isSolved(next)) later(solve, 900)
  else if (guided.value) later(showGuide, newItem !== undefined ? 1600 : 1200)
}

function toolsFor(scale) {
  const b = board.value
  const p = pending.value
  const list = []
  if (phase.value !== 'play') return list
  if (p) {
    if (p.id === scale.id) list.push({ name: 'cancel' })
    else if (p.type === 'swap' && swapTimes(getScale(b, p.id), scale)) list.push({ name: 'swapHere' })
    else if (p.type === 'combine' && canCombine(b, p.id, scale.id)) list.push({ name: 'combineHere' })
    return list
  }
  if (tools.includes('takeAway') && scale.blocks.length && Object.keys(scale.counts).length) {
    list.push({ name: 'take', v: scale.blocks[0] })
  }
  if (tools.includes('share')) {
    const n = shareFactor(scale)
    if (n) list.push({ name: 'share', n })
  }
  if (tools.includes('swap') && b.scales.some((other) => swapTimes(scale, other))) list.push({ name: 'swap' })
  if (tools.includes('combine') && b.scales.length < MAX_SCALES && b.scales.some((o) => canCombine(b, scale.id, o.id))) {
    list.push({ name: 'combine' })
  }
  if (canRemove(b, scale.id)) list.push({ name: 'remove' })
  return list
}

const TOOL_ICONS = {
  take: '✋',
  share: '✂️',
  swap: '🔄',
  swapHere: '⤵️',
  combine: '➕',
  combineHere: '➕',
  remove: '🗑️',
  cancel: '✖️',
}

function toolLabel(tool) {
  const names = {
    take: t('tool.takeAway', { v: tool.v }),
    share: t('tool.share'),
    swap: t('tool.swap'),
    swapHere: t('tool.swapHere'),
    combine: t('tool.combine'),
    combineHere: t('tool.combineHere'),
    remove: t('tool.remove'),
    cancel: t('tool.cancel'),
  }
  return names[tool.name]
}

function mathLabel(tool) {
  if (tool.name === 'take') return t('math.takeAway', { v: tool.v })
  if (tool.name === 'share') return t('math.share', { n: tool.n })
  if (tool.name === 'swap') return t('math.swap')
  if (tool.name === 'combine') return t('math.combine')
  return ''
}

function onTool(scale, tool) {
  const move = hint.value?.move
  if (tool.name === 'take') commit({ type: 'takeAway', scaleId: scale.id, index: 0 })
  else if (tool.name === 'share') commit({ type: 'share', scaleId: scale.id })
  else if (tool.name === 'swapHere') commit({ type: 'swap', sourceId: pending.value.id, targetId: scale.id })
  else if (tool.name === 'combineHere') commit({ type: 'combine', aId: pending.value.id, bId: scale.id })
  else if (tool.name === 'remove') commit({ type: 'remove', scaleId: scale.id })
  else if (tool.name === 'cancel') {
    pending.value = null
    play('tap')
  } else if (tool.name === 'swap' || tool.name === 'combine') {
    pending.value = { type: tool.name, id: scale.id }
    play('select')
    const followsHint = move && move.type === tool.name && (move.sourceId ?? move.aId) === scale.id
    if (!followsHint) {
      hint.value = null
      say(tool.name === 'swap' ? 'msg.pickSwap' : 'msg.pickCombine', { id: scale.id }, 'think')
    }
  }
}

function canTapBlocks(scale) {
  return phase.value === 'play' && !pending.value && tools.includes('takeAway') && scale.blocks.length > 0
}

function cardClass(scale) {
  const p = pending.value
  const target = p && p.id !== scale.id && toolsFor(scale).length > 0
  return {
    found: Boolean(discovered(scale)),
    selected: p?.id === scale.id,
    target,
    dim: p && p.id !== scale.id && !target,
    hinted: Boolean(focus.value[scale.id]),
  }
}

// —— 侦探笔记和称一称 ——
function noteValue(item) {
  return found.value[item] ?? guesses[item] ?? null
}

function openPad(item) {
  if (phase.value !== 'play' || found.value[item] !== undefined) return
  play('tap')
  padItem.value = item
}

function setGuess(value) {
  const item = padItem.value
  padItem.value = null
  if (value == null) delete guesses[item]
  else guesses[item] = value
  weighValues.value = null
}

function onWeigh() {
  if (phase.value !== 'play') return
  const values = {}
  for (const item of items.value) {
    const v = noteValue(item)
    if (v == null) {
      say('msg.fill', {}, 'think')
      play('wrong')
      return
    }
    values[item] = v
  }
  pending.value = null
  hint.value = null
  weighValues.value = values
  const tipped = weighAll(board.value, values).filter((r) => !r.balanced).length
  if (tipped === 0) {
    play('move')
    later(solve, 1000)
  } else {
    if (!guided.value) penalty.value++
    say(tipped === 1 ? 'msg.tipped.one' : 'msg.tipped.many', { n: tipped }, 'oops')
    play('wrong')
  }
}

// —— 撤销 / 重来 / 破案 ——
function afterRewind(key) {
  clearTimers()
  pending.value = null
  hint.value = null
  stuck.value = false
  weighValues.value = null
  say(key)
  play('tap')
  if (guided.value) later(showGuide, 900)
}

function undo() {
  if (!history.value.length || phase.value !== 'play') return
  board.value = history.value.pop()
  afterRewind('msg.undo')
}

function reset() {
  if (phase.value !== 'play') return
  board.value = puzzle.value.board
  history.value = []
  afterRewind('msg.reset')
}

function solve() {
  if (phase.value !== 'play') return
  phase.value = 'solved'
  hint.value = null
  pending.value = null
  say('msg.solved', {}, 'happy')
  play('solved')
  confetti.value?.fire()
}

const answerText = computed(() =>
  items.value
    .map((item) => `${itemLabel(item)} = ${puzzle.value.answer[item]}`)
    .join(lang() === 'zh' ? '，' : ', '),
)

function nextCase() {
  clearTimers()
  if (index.value < puzzles.length - 1) {
    index.value++
    board.value = puzzle.value.board
    history.value = []
    for (const key of Object.keys(guesses)) delete guesses[key]
    weighValues.value = null
    pending.value = null
    hint.value = null
    event.value = null
    phase.value = 'play'
    say('msg.newCase')
    play('tap')
  } else {
    const stars = starsFor(penalty.value)
    result.value = { stars, ...recordLevel(props.level.id, stars) }
    phase.value = 'done'
  }
}
</script>

<template>
  <div class="level">
    <header class="topbar">
      <button type="button" class="btn btn-soft btn-small" @click="emit('exit')">
        ← <span class="hide-narrow">{{ t('level.map') }}</span>
      </button>
      <div class="topbar-title">
        <p class="eyebrow">{{ level.id }} · {{ t('level.case', { n: index + 1, total: puzzles.length }) }}</p>
        <h1>{{ t(`level.${level.id}`) }}</h1>
      </div>
      <div class="topbar-actions">
        <button type="button" class="btn btn-soft btn-small" :disabled="!history.length || phase !== 'play'" :aria-label="t('level.undo')" @click="undo">
          ↶ <span class="hide-narrow">{{ t('level.undo') }}</span>
        </button>
        <button type="button" class="btn btn-soft btn-small" :class="{ pulse: stuck }" :disabled="phase !== 'play'" :aria-label="t('level.reset')" @click="reset">
          ↺ <span class="hide-narrow">{{ t('level.reset') }}</span>
        </button>
        <button type="button" class="btn btn-sun btn-small" :disabled="phase !== 'play'" @click="onHint">💡 {{ t('level.hint') }}</button>
      </div>
    </header>

    <OwlSays class="owl-row" :text="bubble.text" :mood="bubble.mood" />

    <TransitionGroup tag="section" name="card" appear class="board" :class="`count-${board.scales.length}`">
      <article v-for="scale in board.scales" :key="`${index}-${scale.id}`" class="clue-card" :class="cardClass(scale)">
        <header class="clue-head">
          <span class="clue-tag">{{ scale.combined ? t('level.combinedClue', { id: scale.id }) : t('level.clue', { id: scale.id }) }}</span>
          <span v-if="discovered(scale)" class="stamp">{{ t('level.found') }}</span>
        </header>
        <BalanceScale
          :scale="scale"
          :items="items"
          :theme="theme"
          :values="weighValues"
          :event="event"
          :takeable="canTapBlocks(scale)"
          :pulse-block="focus[scale.id] === 'take' ? 0 : -1"
          @take="(i) => commit({ type: 'takeAway', scaleId: scale.id, index: i })"
        />
        <EquationLine :scale="scale" :items="items" :theme="theme" />
        <div class="clue-tools">
          <button
            v-for="tool in toolsFor(scale)"
            :key="tool.name"
            type="button"
            class="tool"
            :class="[`tool-${tool.name}`, { pulse: focus[scale.id] === tool.name }]"
            @click="onTool(scale, tool)"
          >
            <span class="tool-main">{{ TOOL_ICONS[tool.name] }} {{ toolLabel(tool) }}</span>
            <span v-if="showMath && mathLabel(tool)" class="tool-math">{{ mathLabel(tool) }}</span>
          </button>
        </div>
      </article>
    </TransitionGroup>

    <footer class="notebook">
      <p class="notebook-title">📒 {{ t('level.notes') }}</p>
      <div class="notebook-row">
        <button
          v-for="item in items"
          :key="`${index}-${item}`"
          type="button"
          class="note"
          :class="{ known: found[item] !== undefined, empty: noteValue(item) == null }"
          :aria-label="`${ITEMS[item][lang()]} = ${noteValue(item) ?? '?'}`"
          @click="openPad(item)"
        >
          <span class="note-item" :class="{ letter: ITEMS[item].letter }" :style="ITEMS[item].letter ? { color: ITEMS[item].color } : null">{{ itemLabel(item) }}</span>
          <span class="note-eq">=</span>
          <span class="note-value">{{ noteValue(item) ?? '?' }}</span>
          <span v-if="found[item] !== undefined" class="note-check" aria-hidden="true">✓</span>
        </button>
        <button type="button" class="btn btn-primary weigh" :disabled="phase !== 'play'" @click="onWeigh">⚖️ {{ t('level.weigh') }}</button>
      </div>
    </footer>

    <Transition name="sheet">
      <div v-if="phase === 'solved'" class="solved-wrap">
        <section class="solved" aria-live="polite">
          <h2 class="solved-title">🎉 {{ t('msg.solved') }}</h2>
          <p class="solved-lead">{{ items.length > 1 ? t('done.system') : t('done.single') }}</p>
          <div class="system" :class="{ braced: items.length > 1 }">
            <EquationLine v-for="s in puzzle.board.scales" :key="s.id" :scale="s" :items="items" :theme="theme" />
          </div>
          <p class="answers">{{ answerText }}</p>
          <button type="button" class="btn btn-primary" @click="nextCase">
            {{ index < puzzles.length - 1 ? t('done.next') : t('done.finish') }} ▶
          </button>
        </section>
      </div>
    </Transition>

    <NumberPad
      v-if="padItem"
      :label="itemLabel(padItem)"
      :letter="Boolean(ITEMS[padItem].letter)"
      :initial="guesses[padItem] ?? null"
      @done="setGuess"
      @close="padItem = null"
    />
    <LevelResult
      v-if="phase === 'done' && result"
      :level="level"
      :stars="result.stars"
      :first-sticker="result.firstSticker"
      :first-gold="result.firstGold"
      :has-next="hasNext"
      @again="emit('again')"
      @next="emit('next')"
      @map="emit('exit')"
    />
    <ConfettiBurst ref="confetti" />
  </div>
</template>

<style scoped>
.board {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 290px), 1fr));
  gap: 14px;
  align-items: start;
}
.board.count-1 {
  max-width: 480px;
  width: 100%;
  margin-inline: auto;
}
.clue-card {
  position: relative;
  display: grid;
  gap: 6px;
  padding: 12px 12px 14px;
  border-radius: var(--radius);
  background: var(--paper);
  border: 3px solid transparent;
  box-shadow: var(--shadow);
  transition: border-color 0.2s, opacity 0.2s, transform 0.2s;
}
.clue-card.found {
  border-color: var(--leaf);
}
.clue-card.selected {
  border-color: var(--teal);
  transform: translateY(-3px);
}
.clue-card.target {
  border: 3px dashed var(--teal);
}
.clue-card.dim {
  opacity: 0.5;
}
.clue-card.hinted {
  animation: glow 1.4s ease-in-out infinite;
}
.clue-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 30px;
}
.clue-tag {
  padding: 3px 12px 3px 10px;
  border-radius: 8px 14px 14px 8px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.95rem;
  letter-spacing: 0.02em;
}
.stamp {
  padding: 2px 10px;
  border: 3px solid var(--leaf);
  border-radius: 10px;
  color: var(--leaf);
  font-weight: 800;
  font-size: 1rem;
  transform: rotate(-8deg);
  animation: stamp 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.clue-tools {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 8px;
  min-height: 48px;
}
.tool {
  display: grid;
  justify-items: center;
  gap: 1px;
  min-height: 48px;
  padding: 8px 14px;
  border: 0;
  border-radius: 14px;
  background: var(--teal-soft);
  box-shadow: 0 3px 0 #a9dde2;
  color: #0d5f68;
  font: inherit;
  font-weight: 600;
  font-size: 1rem;
  cursor: pointer;
}
.tool:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 #a9dde2;
}
.tool-math {
  font-size: 0.78rem;
  font-weight: 500;
  opacity: 0.85;
}
.tool-swapHere,
.tool-combineHere {
  background: var(--teal);
  box-shadow: 0 3px 0 #0d5f68;
  color: #fff;
}
.tool-cancel {
  background: #fff;
  box-shadow: 0 3px 0 var(--paper-line);
  color: var(--ink-soft);
}
.tool-remove {
  background: #fff;
  box-shadow: 0 3px 0 var(--paper-line);
  color: var(--ink-soft);
}
.tool.pulse {
  animation: pulse-btn 1s ease-in-out infinite;
}

.notebook {
  position: sticky;
  bottom: 0;
  z-index: 5;
  margin-inline: -16px;
  padding: 10px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: rgba(255, 253, 246, 0.94);
  backdrop-filter: blur(6px);
  border-top: 3px solid var(--paper-line);
}
.notebook-title {
  margin: 0 0 6px;
  font-size: 0.9rem;
  font-weight: 700;
  color: var(--ink-soft);
  letter-spacing: 0.04em;
}
.notebook-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
}
.note {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 52px;
  padding: 6px 14px;
  border-radius: 16px;
  border: 3px solid var(--teal);
  background: #fff;
  color: var(--teal);
  font: inherit;
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
}
.note.empty {
  border-style: dashed;
  color: var(--ink-soft);
}
.note.known {
  border-color: var(--leaf);
  background: var(--leaf-soft);
  color: var(--leaf);
  cursor: default;
}
.note-item {
  font-family: var(--emoji);
}
.note-item.letter {
  font-family: var(--font);
  font-style: italic;
}
.note-eq {
  color: var(--ink-soft);
}
.note-check {
  font-size: 1.1rem;
}
.weigh {
  margin-left: auto;
}

.solved-wrap {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
  pointer-events: none;
}
.solved {
  pointer-events: auto;
  width: min(520px, 100%);
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 18px 18px 20px;
  border-radius: 26px;
  background: var(--paper);
  border: 3px solid var(--leaf);
  box-shadow: var(--shadow);
  text-align: center;
}
.solved-title {
  margin: 0;
  font-size: 1.8rem;
}
.solved-lead {
  margin: 0;
  color: var(--ink-soft);
  font-weight: 600;
}
.system {
  display: grid;
  gap: 2px;
  padding: 4px 10px;
}
.system.braced {
  position: relative;
  padding-left: 22px;
}
.system.braced::before {
  content: '';
  position: absolute;
  left: 4px;
  top: 4px;
  bottom: 4px;
  width: 10px;
  border: 3px solid var(--ink);
  border-right: 0;
  border-radius: 12px 0 0 12px;
}
.system :deep(.equation) {
  justify-content: flex-start;
}
.answers {
  margin: 0;
  padding: 6px 14px;
  border-radius: 12px;
  background: var(--leaf-soft);
  color: var(--leaf);
  font-size: 1.3rem;
  font-weight: 700;
}
.sheet-enter-active {
  transition: transform 0.35s cubic-bezier(0.3, 1.3, 0.5, 1), opacity 0.2s;
}
.sheet-enter-from {
  transform: translateY(60px);
  opacity: 0;
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
@keyframes glow {
  50% {
    box-shadow: 0 0 0 6px rgba(255, 201, 60, 0.55), var(--shadow);
  }
}
@keyframes pulse-btn {
  50% {
    transform: scale(1.08);
    box-shadow: 0 0 0 5px rgba(255, 201, 60, 0.7);
  }
}
@keyframes stamp {
  from {
    transform: rotate(-8deg) scale(2);
    opacity: 0;
  }
}
</style>
