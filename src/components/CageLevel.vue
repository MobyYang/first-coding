<script setup>
// 鸡兔同笼：往笼子里放鸡和兔子，让头数和脚数都对上。
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import ConfettiBurst from './ConfettiBurst.vue'
import LevelResult from './LevelResult.vue'
import OwlSays from './OwlSays.vue'
import { applyCage, cageCounts, cageHint, cageSolved, generateCageLevel } from '../core/cage.js'
import { starsFor } from '../core/levels.js'
import { randomSeed } from '../core/random.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { recordLevel } from '../store.js'

const props = defineProps({
  level: { type: Object, required: true },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['exit', 'again', 'next'])

const puzzles = generateCageLevel(props.level, randomSeed())
const index = ref(0)
const puzzle = computed(() => puzzles[index.value])
const cage = ref({ chickens: 0, rabbits: 0 })
const phase = ref('play')
const penalty = ref(0)
const hint = ref(null)
const message = ref({ key: `level.${props.level.id}.intro`, params: {}, mood: 'think' })
const result = ref(null)
const confetti = ref(null)
let timers = []

const guided = computed(() => Boolean(props.level.tutorial) && index.value === 0)
const counts = computed(() => cageCounts(cage.value))

const animals = computed(() => [
  ...Array.from({ length: cage.value.chickens }, (_, i) => ({ key: `c${i}`, emoji: '🐔', legs: 2 })),
  ...Array.from({ length: cage.value.rabbits }, (_, i) => ({ key: `r${i}`, emoji: '🐰', legs: 4 })),
])

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

// 提示：第一次问一个问题帮孩子想，第二次告诉用哪个按钮；从不替孩子放动物
function hintMessage(h) {
  const key = h.level === 1 ? `cage.think.${h.step}` : `cage.hint.${h.step}`
  return t(key, { h: puzzle.value.heads })
}

const bubble = computed(() => {
  if (hint.value && phase.value === 'play') return { text: hintMessage(hint.value), mood: 'think' }
  return { text: t(message.value.key, message.value.params), mood: message.value.mood }
})

function showGuide() {
  if (phase.value !== 'play') return
  const h = cageHint(puzzle.value, cage.value)
  hint.value = h ? { ...h, level: 2 } : null
}

function act(action) {
  if (phase.value !== 'play') return
  const next = applyCage(cage.value, action)
  if (!next) {
    say(action.startsWith('add') ? 'cage.full' : 'cage.empty', {}, 'oops')
    play('wrong')
    return
  }
  clearTimers()
  cage.value = next
  hint.value = null
  play(action.includes('To') ? 'found' : 'move')
  if (cageSolved(puzzle.value, next)) {
    later(solve, 600)
  } else if (guided.value) {
    later(showGuide, 700)
  }
}

function onHint() {
  if (phase.value !== 'play') return
  play('tap')
  const h = cageHint(puzzle.value, cage.value)
  if (!h) return
  const same = hint.value && hint.value.step === h.step
  if (same && hint.value.level >= 2) return
  if (!guided.value) penalty.value++
  hint.value = { ...h, level: same ? 2 : 1 }
}

function reset() {
  if (phase.value !== 'play') return
  clearTimers()
  cage.value = { chickens: 0, rabbits: 0 }
  hint.value = null
  say('msg.reset')
  play('tap')
  if (guided.value) later(showGuide, 900)
}

function solve() {
  if (phase.value !== 'play') return
  phase.value = 'solved'
  say('msg.solved', {}, 'happy')
  play('solved')
  confetti.value?.fire()
}

function nextCase() {
  clearTimers()
  if (index.value < puzzles.length - 1) {
    index.value++
    cage.value = { chickens: 0, rabbits: 0 }
    hint.value = null
    phase.value = 'play'
    say('msg.newCase')
    play('tap')
  } else {
    const stars = starsFor(penalty.value)
    result.value = { stars, ...recordLevel(props.level.id, stars) }
    phase.value = 'done'
  }
}

function meter(current, target) {
  if (current === target) return 'ok'
  return current < target ? 'low' : 'high'
}

const BUTTONS = [
  { action: 'addChicken', icon: '＋ 🐔', label: 'cage.addChicken' },
  { action: 'removeChicken', icon: '－ 🐔', label: 'cage.removeChicken' },
  { action: 'addRabbit', icon: '＋ 🐰', label: 'cage.addRabbit' },
  { action: 'removeRabbit', icon: '－ 🐰', label: 'cage.removeRabbit' },
]
const MAGIC = [
  { action: 'chickenToRabbit', icon: '🪄 🐔 → 🐰', label: 'cage.toRabbit' },
  { action: 'rabbitToChicken', icon: '🪄 🐰 → 🐔', label: 'cage.toChicken' },
]
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
        <button type="button" class="btn btn-soft btn-small" :disabled="phase !== 'play'" :aria-label="t('level.reset')" @click="reset">
          ↺ <span class="hide-narrow">{{ t('level.reset') }}</span>
        </button>
        <button type="button" class="btn btn-sun btn-small" :disabled="phase !== 'play'" @click="onHint">💡 {{ t('level.hint') }}</button>
      </div>
    </header>

    <OwlSays class="owl-row" :text="bubble.text" :mood="bubble.mood" />

    <section class="cage-layout">
      <div class="cage-card">
        <p class="story">{{ t('cage.story', { h: puzzle.heads, l: puzzle.legs }) }}</p>
        <div class="meters">
          <div class="meter" :class="meter(counts.heads, puzzle.heads)">
            <span class="meter-label">🙂 {{ t('cage.heads') }}</span>
            <span class="meter-value">{{ counts.heads }} / {{ puzzle.heads }}</span>
            <span class="meter-mark" aria-hidden="true">{{ counts.heads === puzzle.heads ? '✓' : counts.heads < puzzle.heads ? '↑' : '↓' }}</span>
          </div>
          <div class="meter" :class="meter(counts.legs, puzzle.legs)">
            <span class="meter-label">🦶 {{ t('cage.legs') }}</span>
            <span class="meter-value">{{ counts.legs }} / {{ puzzle.legs }}</span>
            <span class="meter-mark" aria-hidden="true">{{ counts.legs === puzzle.legs ? '✓' : counts.legs < puzzle.legs ? '↑' : '↓' }}</span>
          </div>
        </div>
        <div class="cage" :aria-label="t('cage.answer', { c: cage.chickens, r: cage.rabbits })">
          <TransitionGroup name="animal" tag="div" class="cage-grid">
            <div v-for="a in animals" :key="a.key" class="animal">
              <span class="animal-emoji">{{ a.emoji }}</span>
              <span class="animal-legs">{{ a.legs }} 🦶</span>
            </div>
          </TransitionGroup>
          <div class="cage-bars" aria-hidden="true"></div>
        </div>
      </div>

      <div class="cage-controls">
        <div class="control-row">
          <button
            v-for="b in BUTTONS"
            :key="b.action"
            type="button"
            class="tool big"
            :class="{ pulse: hint && hint.level === 2 && hint.action === b.action }"
            :aria-label="t(b.label)"
            :disabled="phase !== 'play'"
            @click="act(b.action)"
          >
            {{ b.icon }}
          </button>
        </div>
        <div class="control-row">
          <button
            v-for="b in MAGIC"
            :key="b.action"
            type="button"
            class="tool big magic"
            :class="{ pulse: hint && hint.level === 2 && hint.action === b.action }"
            :aria-label="t(b.label)"
            :disabled="phase !== 'play'"
            @click="act(b.action)"
          >
            <span>{{ b.icon }}</span>
            <span class="tool-math">{{ t(b.label) }}</span>
          </button>
        </div>
      </div>
    </section>

    <Transition name="sheet">
      <div v-if="phase === 'solved'" class="solved-wrap">
        <section class="solved" aria-live="polite">
          <h2 class="solved-title">🎉 {{ t('msg.solved') }}</h2>
          <p class="answers">{{ t('cage.answer', { c: puzzle.answer.chickens, r: puzzle.answer.rabbits }) }}</p>
          <p class="solved-lead">{{ t('cage.system') }}</p>
          <div class="system braced">
            <p class="equation">🐔 + 🐰 = {{ puzzle.heads }}</p>
            <p class="equation">2 × 🐔 + 4 × 🐰 = {{ puzzle.legs }}</p>
          </div>
          <p class="fact">📜 {{ t('cage.fact') }}</p>
          <button type="button" class="btn btn-primary" @click="nextCase">
            {{ index < puzzles.length - 1 ? t('done.next') : t('done.finish') }} ▶
          </button>
        </section>
      </div>
    </Transition>

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
.cage-layout {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr));
  align-items: start;
}
.cage-card {
  display: grid;
  gap: 12px;
  padding: 16px;
  border-radius: var(--radius);
  background: var(--paper);
  box-shadow: var(--shadow);
}
.story {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
  line-height: 1.5;
  text-wrap: pretty;
}
.meters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.meter {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 2px 8px;
  padding: 10px 12px;
  border-radius: 16px;
  border: 3px solid var(--paper-line);
  background: #fff;
}
.meter-label {
  font-weight: 600;
  color: var(--ink-soft);
}
.meter-value {
  grid-column: 1;
  font-size: 1.6rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.meter-mark {
  grid-row: 1 / span 2;
  grid-column: 2;
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--ink-soft);
}
.meter.ok {
  border-color: var(--leaf);
  background: var(--leaf-soft);
}
.meter.ok .meter-mark,
.meter.ok .meter-value {
  color: var(--leaf);
}
.meter.high {
  border-color: #f3b0b0;
}
.cage {
  position: relative;
  min-height: 190px;
  padding: 14px;
  border-radius: 18px;
  background: linear-gradient(180deg, #fff7e2, #f6e2b8);
  border: 5px solid var(--wood-dark);
  overflow: hidden;
}
.cage-bars {
  position: absolute;
  inset: 0;
  pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0 34px, rgba(168, 109, 54, 0.35) 34px 38px);
}
.cage-grid {
  position: relative;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(62px, 1fr));
  gap: 8px;
}
.animal {
  display: grid;
  justify-items: center;
  padding: 4px 0;
  border-radius: 14px;
  background: rgba(255, 255, 255, 0.75);
}
.animal-emoji {
  font-family: var(--emoji);
  font-size: 2.2rem;
  line-height: 1.2;
}
.animal-legs {
  font-size: 0.8rem;
  font-weight: 700;
  color: var(--wood-dark);
}
.cage-controls {
  display: grid;
  gap: 12px;
  align-content: start;
}
.control-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
}
.tool {
  display: grid;
  justify-items: center;
  gap: 2px;
  min-height: 56px;
  padding: 8px 12px;
  border: 0;
  border-radius: 16px;
  background: var(--teal-soft);
  box-shadow: 0 4px 0 #a9dde2;
  color: #0d5f68;
  font: inherit;
  font-weight: 700;
  font-size: 1.3rem;
  cursor: pointer;
}
.tool:active {
  transform: translateY(2px);
  box-shadow: 0 1px 0 #a9dde2;
}
.tool.magic {
  background: #fff1cc;
  box-shadow: 0 4px 0 #f0cf7a;
  color: #7a5200;
}
.tool-math {
  font-size: 0.85rem;
  font-weight: 600;
}
.tool.pulse {
  animation: pulse-btn 1s ease-in-out infinite;
}
.animal-enter-active {
  animation: pop 0.35s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.animal-leave-active {
  animation: pop 0.25s ease-in reverse;
}
.solved-wrap {
  position: fixed;
  inset: auto 0 0 0;
  z-index: 30;
  display: flex;
  justify-content: center;
  padding: 0 16px calc(16px + env(safe-area-inset-bottom, 0px));
}
.solved {
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
.answers {
  margin: 0;
  padding: 6px 14px;
  border-radius: 12px;
  background: var(--leaf-soft);
  color: var(--leaf);
  font-size: 1.3rem;
  font-weight: 700;
}
.system {
  position: relative;
  display: grid;
  gap: 2px;
  padding: 4px 10px 4px 24px;
  text-align: left;
}
.system::before {
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
.equation {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
.fact {
  margin: 0;
  font-size: 0.95rem;
  color: var(--ink-soft);
  text-wrap: pretty;
}
.sheet-enter-active {
  transition: transform 0.35s cubic-bezier(0.3, 1.3, 0.5, 1), opacity 0.2s;
}
.sheet-enter-from {
  transform: translateY(60px);
  opacity: 0;
}
@keyframes pop {
  from {
    transform: scale(0.3);
    opacity: 0;
  }
}
@keyframes pulse-btn {
  50% {
    transform: scale(1.06);
    box-shadow: 0 0 0 5px rgba(255, 201, 60, 0.7);
  }
}
</style>
