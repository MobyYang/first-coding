<script setup>
// 天平关卡：几架平衡的天平（线索）+ 侦探道具。
// 道具只负责摆天平，右边的算术要孩子自己算，算对了天平才会变。
// 某样东西被单独称出来，它的重量（孩子算出来的数）就记进侦探笔记；全部找到就破案。
import { computed, onBeforeUnmount, ref } from 'vue'
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
  moveArithmetic,
  shareFactor,
  swapTimes,
} from '../core/scale.js'
import { planSolution } from '../core/solver.js'
import { ITEMS, itemLabel } from '../items.js'
import { hasKey, lang, t } from '../i18n.js'
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
const calc = ref(null)
const hint = ref(null)
const penalty = ref(0)
const event = ref(null)
const message = ref({ key: `level.${props.level.id}.intro`, params: {}, mood: 'think' })
const phase = ref('play')
const result = ref(null)
const confetti = ref(null)
let timers = []

const items = computed(() => board.value.items)
const found = computed(() => discoveredValues(board.value))

function later(fn, ms) {
  timers.push(setTimeout(fn, ms))
}
function clearTimers() {
  timers.forEach(clearTimeout)
  timers = []
}
onBeforeUnmount(clearTimers)

function say(key, params = {}, mood = 'think') {
  message.value = { key, params, mood }
}

// —— 文字：用天平上真实的东西和数字，但从不出现答案 ——
function groupOf(counts) {
  return items.value
    .filter((item) => counts[item])
    .map((item) => (counts[item] > 1 ? `${counts[item]}${itemLabel(item)}` : itemLabel(item)))
    .join(' + ')
}

function scaled(counts, factor) {
  return Object.fromEntries(Object.entries(counts).map(([item, n]) => [item, n * factor]))
}

function minus(counts, taken, times) {
  const out = { ...counts }
  for (const [item, n] of Object.entries(taken)) {
    out[item] = (out[item] || 0) - n * times
    if (out[item] <= 0) delete out[item]
  }
  return out
}

// 说话时的写法：“3 个 🍇”“🍐 和 2 个 🍎”；括号里的一组东西才写成算式（🍐 + 2🍎）
function itemsWords(counts) {
  const zh = lang() === 'zh'
  return items.value
    .filter((item) => counts[item])
    .map((item) => {
      const n = counts[item]
      if (n === 1) return itemLabel(item)
      return zh ? `${n} 个 ${itemLabel(item)}` : `${n} ${itemLabel(item)}`
    })
    .join(zh ? ' 和 ' : ' and ')
}

function listOf(values) {
  const shown = theme === 'shop' ? values.map((v) => t('level.yuan', { v })) : values
  return shown.join(lang() === 'zh' ? ' 和 ' : ' and ')
}

// 小卖部的未知数是价钱，有专门的说法就用专门的
function themed(key) {
  return theme === 'shop' && hasKey(`${key}.shop`) ? `${key}.shop` : key
}
function tt(key, params = {}) {
  return t(themed(key), params)
}

// 分一分：只有一种东西（4🍎 = 36）和几份一样的组合（2🍎 + 2🍌 = 18）说法不同
function shareWords(scale) {
  const g = shareFactor(scale)
  const kinds = Object.keys(scale.counts)
  if (kinds.length === 1) return { key: 'One', params: { id: scale.id, n: g, item: itemLabel(kinds[0]), total: scale.right } }
  return { key: 'Group', params: { id: scale.id, g, group: groupOf(scaled(scale.counts, 1 / g)), total: scale.right } }
}

// —— 提示：只在点“提示”时出现。第一次从要找的答案出发问一个问题，第二次告诉用哪个道具 ——
function thinkText(move) {
  const b = board.value
  if (move.type === 'share') {
    const { key, params } = shareWords(getScale(b, move.scaleId))
    return tt(`think.share${key}`, params)
  }
  if (move.type === 'takeAway') {
    const s = getScale(b, move.scaleId)
    const params = { id: s.id, items: itemsWords(s.counts), v: s.blocks[move.index ?? 0], blocks: listOf(s.blocks), total: s.right }
    return tt(s.blocks.length > 1 ? 'think.takeAwayMany' : 'think.takeAway', params)
  }
  if (move.type === 'swap') {
    const src = getScale(b, move.sourceId)
    const dst = getScale(b, move.targetId)
    const k = swapTimes(src, dst)
    const rest = itemsWords(minus(dst.counts, src.counts, k))
    const d = discovered(src)
    if (d) return tt('think.swapKnown', { src: src.id, dst: dst.id, item: itemLabel(d.item), rest })
    if (k === 1 && dst.blocks.length === 0) return tt('think.swapCompare', { src: src.id, dst: dst.id, extra: rest })
    return tt('think.swapBundle', { src: src.id, dst: dst.id, k, group: groupOf(src.counts), w: src.right, rest })
  }
  if (move.type === 'combine') {
    const a = getScale(b, move.aId)
    const c = getScale(b, move.bId)
    const sum = scaled(a.counts, 1)
    for (const [item, n] of Object.entries(c.counts)) sum[item] = (sum[item] || 0) + n
    const g = Object.values(sum).reduce((x, y) => {
      while (y) [x, y] = [y, x % y]
      return x
    })
    return tt('think.combine', { a: a.id, b: c.id, group: groupOf(scaled(sum, 1 / g)) })
  }
  return t('think.remove')
}

function toolText(move) {
  const b = board.value
  if (move.type === 'share') {
    const { key, params } = shareWords(getScale(b, move.scaleId))
    return tt(`hint.share${key}`, params)
  }
  if (move.type === 'takeAway') {
    const s = getScale(b, move.scaleId)
    const params = { id: s.id, v: s.blocks[move.index ?? 0], items: itemsWords(s.counts) }
    return tt(s.blocks.length > 1 ? 'hint.takeAwayMore' : 'hint.takeAway', params)
  }
  if (move.type === 'swap') {
    const src = getScale(b, move.sourceId)
    const d = discovered(src)
    return d
      ? tt('hint.swapKnown', { src: src.id, dst: move.targetId, item: itemLabel(d.item) })
      : tt('hint.swapBundle', { src: src.id, dst: move.targetId, group: groupOf(src.counts), w: src.right })
  }
  if (move.type === 'combine') return t('hint.combine', { a: move.aId, b: move.bId })
  return t('hint.remove', { id: move.scaleId })
}

const bubble = computed(() => {
  const h = hint.value
  if (h && phase.value === 'play') {
    if (h.stuck) return { text: t('hint.stuck'), mood: 'oops' }
    return { text: h.level === 1 ? thinkText(h.move) : toolText(h.move), mood: 'think' }
  }
  return { text: t(message.value.key, message.value.params), mood: message.value.mood }
})

// 第二次提示才让对应的按钮闪
const focus = computed(() => {
  const h = hint.value
  if (!h || h.stuck || h.level < 2 || phase.value !== 'play') return {}
  const m = h.move
  if (m.type === 'share') return { [m.scaleId]: 'share' }
  if (m.type === 'takeAway') return { [m.scaleId]: 'take' }
  if (m.type === 'swap') return { [m.targetId]: `swap-${m.sourceId}` }
  if (m.type === 'combine') return { [m.aId]: `combine-${m.bId}` }
  return { [m.scaleId]: 'remove' }
})

function onHint() {
  if (phase.value !== 'play' || isSolved(board.value)) return
  play('tap')
  const plan = planSolution(board.value, tools)
  if (!plan || !plan.length) {
    hint.value = { stuck: true }
    return
  }
  const move = plan[0]
  const same = hint.value && !hint.value.stuck && JSON.stringify(hint.value.move) === JSON.stringify(move)
  if (same && hint.value.level >= 2) return
  penalty.value++
  hint.value = { move, level: same ? 2 : 1 }
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
  board.value = next
  hint.value = null
  event.value = describe(move, before, next)

  const nowFound = discoveredValues(next)
  const newItem = next.items.find((item) => nowFound[item] !== undefined && beforeFound[item] === undefined)
  if (newItem !== undefined) {
    const scale = next.scales.find((s) => discovered(s)?.item === newItem)
    say(themed('msg.found'), { id: scale.id, item: itemLabel(newItem), v: nowFound[newItem] }, 'wow')
    play('found')
  } else {
    if (move.type === 'swap') say('msg.swapped', {}, 'happy')
    else if (move.type === 'combine') say('msg.combined', { id: event.value.scaleIds[0] }, 'wow')
    else if (move.type === 'remove') say('msg.removed', {}, 'think')
    else say('msg.calcRight', {}, 'happy')
    play('move')
  }
  if (isSolved(next)) later(solve, 1100)
}

// 分一分、拿走、合起来：先让孩子算出右边变成多少，算对了天平才变
function startMove(move) {
  const arithmetic = moveArithmetic(board.value, move)
  if (!arithmetic) {
    commit(move)
    return
  }
  play('select')
  hint.value = null
  calc.value = { move, arithmetic, feedback: '', attempt: 0 }
}

function calcTip(a) {
  if (a.op === '÷') return t('calc.tip.share', { n: a.b, total: a.a })
  if (a.op === '−') return t('calc.tip.takeAway', { v: a.b, total: a.a })
  return a.a >= 10 || a.b >= 10 ? t('calc.tip.combine') : t('calc.tip.combineSmall', { a: a.a, b: a.b })
}

const calcView = computed(() => {
  const c = calc.value
  if (!c) return null
  const { move, arithmetic: a } = c
  let heading
  let explain
  if (move.type === 'share') {
    const words = shareWords(getScale(board.value, move.scaleId))
    heading = `✂️ ${t('tool.share')} · ${t('level.clue', { id: move.scaleId })}`
    explain = tt(`calc.share${words.key}`, words.params)
  } else if (move.type === 'takeAway') {
    heading = `✋ ${t('tool.takeAway', { v: a.b })} · ${t('level.clue', { id: move.scaleId })}`
    explain = tt('calc.takeAway', { v: a.b })
  } else {
    heading = `➕ ${t('tool.combine')} · ${move.aId} + ${move.bId}`
    explain = tt('calc.combine')
  }
  return { heading, explain, expression: `${a.a} ${a.op} ${a.b}` }
})

function onCalcDone(value) {
  const c = calc.value
  if (!c) return
  if (value === c.arithmetic.result) {
    calc.value = null
    commit(c.move)
    return
  }
  penalty.value++
  play('wrong')
  calc.value = { ...c, feedback: `${t('calc.wrong')} ${calcTip(c.arithmetic)}`, attempt: c.attempt + 1 }
}

function onCalcTip() {
  const c = calc.value
  if (!c) return
  play('tap')
  calc.value = { ...c, feedback: calcTip(c.arithmetic) }
}

function onCalcClose() {
  calc.value = null
  play('tap')
}

// 每架天平上能用的道具。换进来、合起来都是一步完成，按钮上写清楚用哪一架
function toolsFor(scale) {
  const b = board.value
  const list = []
  if (phase.value !== 'play') return list
  if (tools.includes('takeAway') && scale.blocks.length && Object.keys(scale.counts).length) {
    list.push({ key: 'take', name: 'take', v: scale.blocks[0] })
  }
  if (tools.includes('share')) {
    const n = shareFactor(scale)
    if (n) list.push({ key: 'share', name: 'share', n })
  }
  if (tools.includes('swap')) {
    for (const source of b.scales) {
      if (swapTimes(source, scale)) list.push({ key: `swap-${source.id}`, name: 'swap', src: source.id })
    }
  }
  if (tools.includes('combine') && b.scales.length < MAX_SCALES) {
    for (const other of b.scales.slice(b.scales.indexOf(scale) + 1)) {
      if (canCombine(b, scale.id, other.id)) list.push({ key: `combine-${other.id}`, name: 'combine', other: other.id })
    }
  }
  if (canRemove(b, scale.id)) list.push({ key: 'remove', name: 'remove' })
  return list
}

const TOOL_ICONS = { take: '✋', share: '✂️', swap: '🔄', combine: '➕', remove: '🗑️' }

function toolLabel(tool) {
  if (tool.name === 'take') return t('tool.takeAway', { v: tool.v })
  if (tool.name === 'share') return t('tool.share')
  if (tool.name === 'swap') return t('tool.swapIn', { src: tool.src })
  if (tool.name === 'combine') return t('tool.combineWith', { other: tool.other })
  return t('tool.remove')
}

function mathLabel(tool) {
  if (tool.name === 'take') return t('math.takeAway', { v: tool.v })
  if (tool.name === 'share') return t('math.share', { n: tool.n })
  if (tool.name === 'swap') return t('math.swap')
  if (tool.name === 'combine') return t('math.combine')
  return ''
}

function onTool(scale, tool) {
  if (tool.name === 'take') startMove({ type: 'takeAway', scaleId: scale.id, index: 0 })
  else if (tool.name === 'share') startMove({ type: 'share', scaleId: scale.id })
  else if (tool.name === 'swap') commit({ type: 'swap', sourceId: tool.src, targetId: scale.id })
  else if (tool.name === 'combine') startMove({ type: 'combine', aId: scale.id, bId: tool.other })
  else commit({ type: 'remove', scaleId: scale.id })
}

function canTapBlocks(scale) {
  return phase.value === 'play' && tools.includes('takeAway') && scale.blocks.length > 0
}

// —— 重来 / 破案 ——
function reset() {
  if (phase.value !== 'play') return
  clearTimers()
  board.value = puzzle.value.board
  hint.value = null
  event.value = null
  say('msg.reset')
  play('tap')
}

function solve() {
  if (phase.value !== 'play') return
  phase.value = 'solved'
  hint.value = null
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
        <button type="button" class="btn btn-soft btn-small" :class="{ pulse: hint?.stuck }" :disabled="phase !== 'play'" :aria-label="t('level.reset')" @click="reset">
          ↺ <span class="hide-narrow">{{ t('level.reset') }}</span>
        </button>
        <button type="button" class="btn btn-sun btn-small" :disabled="phase !== 'play'" @click="onHint">💡 {{ t('level.hint') }}</button>
      </div>
    </header>

    <OwlSays class="owl-row" :text="bubble.text" :mood="bubble.mood" />

    <TransitionGroup tag="section" name="card" appear class="board" :class="`count-${board.scales.length}`">
      <article v-for="scale in board.scales" :key="`${index}-${scale.id}`" class="clue-card" :class="{ found: Boolean(discovered(scale)), hinted: Boolean(focus[scale.id]) }">
        <header class="clue-head">
          <span class="clue-tag">{{ scale.combined ? t('level.combinedClue', { id: scale.id }) : t('level.clue', { id: scale.id }) }}</span>
          <span v-if="discovered(scale)" class="stamp">{{ t('level.found') }}</span>
        </header>
        <BalanceScale
          :scale="scale"
          :items="items"
          :theme="theme"
          :event="event"
          :takeable="canTapBlocks(scale)"
          :pulse-block="focus[scale.id] === 'take' ? 0 : -1"
          @take="(i) => startMove({ type: 'takeAway', scaleId: scale.id, index: i })"
        />
        <EquationLine :scale="scale" :items="items" :theme="theme" />
        <div class="clue-tools">
          <button
            v-for="tool in toolsFor(scale)"
            :key="tool.key"
            type="button"
            class="tool"
            :class="[`tool-${tool.name}`, { pulse: focus[scale.id] === tool.key }]"
            @click="onTool(scale, tool)"
          >
            <span class="tool-main">{{ TOOL_ICONS[tool.name] }} {{ toolLabel(tool) }}</span>
            <span v-if="showMath && mathLabel(tool)" class="tool-math">{{ mathLabel(tool) }}</span>
          </button>
        </div>
      </article>
    </TransitionGroup>

    <footer class="notebook" aria-live="polite">
      <p class="notebook-title">📒 {{ t('level.notes') }}</p>
      <div class="notebook-row">
        <span v-for="item in items" :key="`${index}-${item}`" class="note" :class="{ known: found[item] !== undefined }">
          <span class="note-item" :class="{ letter: ITEMS[item].letter }" :style="ITEMS[item].letter ? { color: ITEMS[item].color } : null">{{ itemLabel(item) }}</span>
          <span class="note-eq">=</span>
          <span class="note-value">{{ found[item] ?? '?' }}</span>
          <span v-if="found[item] !== undefined" class="note-check" aria-hidden="true">✓</span>
        </span>
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
      v-if="calcView"
      :heading="calcView.heading"
      :explain="calcView.explain"
      :expression="calcView.expression"
      :feedback="calc.feedback"
      :attempt="calc.attempt"
      @done="onCalcDone"
      @tip="onCalcTip"
      @close="onCalcClose"
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
  transition: border-color 0.2s;
}
.clue-card.found {
  border-color: var(--leaf);
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
  min-height: 48px;
  padding: 6px 14px;
  border-radius: 16px;
  border: 3px dashed var(--paper-line);
  background: #fff;
  color: var(--ink-soft);
  font-size: 1.4rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.note.known {
  border-style: solid;
  border-color: var(--leaf);
  background: var(--leaf-soft);
  color: var(--leaf);
  animation: note-pop 0.4s cubic-bezier(0.3, 1.6, 0.5, 1);
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
@keyframes note-pop {
  from {
    transform: scale(0.6);
  }
}
</style>
