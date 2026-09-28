<script setup>
// 一架会晃动的天平（SVG）。左盘放神秘东西和砝码，右盘放一个大砝码。
// 用道具时天平晃一晃再停稳，让孩子看到“两边一起变，还是平衡的”。
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { ITEMS } from '../items.js'
import { t } from '../i18n.js'

const props = defineProps({
  scale: { type: Object, required: true },
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  event: { type: Object, default: null },
  takeable: { type: Boolean, default: false },
  pulseBlock: { type: Number, default: -1 },
})
const emit = defineEmits(['take'])

const CX = 190
const CY = 158
const ARM = 118
const PLATE_TOP = -22
const GAP = 3
const MAX_ROW = 140

const reduceMotion =
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// —— 左盘上的东西 ——
const pieces = computed(() => {
  const list = []
  for (const item of props.items) {
    const n = props.scale.counts[item] || 0
    for (let copy = 0; copy < n; copy++) list.push({ key: `${item}-${copy}`, kind: 'item', item })
  }
  const seen = {}
  props.scale.blocks.forEach((value, index) => {
    seen[value] = (seen[value] || 0) + 1
    list.push({ key: `b${value}-${seen[value]}`, kind: 'block', value, index })
  })
  const shrink = list.length > 8 ? 0.8 : 1
  return list.map((p) => ({ ...p, w: (p.kind === 'block' ? 40 : 32) * shrink, h: 34 * shrink, shrink }))
})

const placed = computed(() => {
  const rows = []
  let row = []
  let width = 0
  for (const piece of pieces.value) {
    const extra = row.length ? GAP + piece.w : piece.w
    if (row.length && width + extra > MAX_ROW) {
      rows.push(row)
      row = []
      width = 0
    }
    width += row.length ? GAP + piece.w : piece.w
    row.push(piece)
  }
  if (row.length) rows.push(row)
  const out = []
  rows.forEach((r, ri) => {
    const rowWidth = r.reduce((s, p) => s + p.w, 0) + GAP * (r.length - 1)
    let x = -rowWidth / 2
    for (const p of r) {
      const rowHeight = 36 * p.shrink
      out.push({ ...p, x: x + p.w / 2, y: PLATE_TOP - rowHeight / 2 - ri * rowHeight })
      x += p.w + GAP
    }
  })
  return out
})

// —— 晃动：弹簧一样晃几下再停在平衡的位置 ——
const angle = ref(0)
let velocity = 0
let frame = 0
function animate() {
  cancelAnimationFrame(frame)
  let last = performance.now()
  const step = (now) => {
    const dt = Math.min(0.032, (now - last) / 1000)
    last = now
    const accel = -95 * angle.value - 7 * velocity
    velocity += accel * dt
    angle.value += velocity * dt
    if (Math.abs(angle.value) < 0.03 && Math.abs(velocity) < 0.05) {
      angle.value = 0
      velocity = 0
      return
    }
    frame = requestAnimationFrame(step)
  }
  frame = requestAnimationFrame(step)
}

function wobble(kick) {
  if (reduceMotion) return
  velocity += kick
  animate()
}

// 每次用道具，天平晃一晃再停稳：让孩子看到“还是平衡的”
watch(
  () => props.event?.key,
  () => {
    if (props.event?.scaleIds?.includes(props.scale.id) && props.event.kind !== 'combine') wobble(38)
  },
)

onBeforeUnmount(() => cancelAnimationFrame(frame))

const rad = computed(() => (angle.value * Math.PI) / 180)
const leftEnd = computed(() => ({ x: CX - ARM * Math.cos(rad.value), y: CY - ARM * Math.sin(rad.value) }))
const rightEnd = computed(() => ({ x: CX + ARM * Math.cos(rad.value), y: CY + ARM * Math.sin(rad.value) }))

// —— 显示用的小工具 ——
function money(value) {
  return props.theme === 'shop' ? t('level.yuan', { v: value }) : String(value)
}

const floatLabel = computed(() => {
  const e = props.event
  if (!e || !e.scaleIds?.includes(props.scale.id)) return null
  if (e.kind === 'share') return `÷ ${e.factor}`
  if (e.kind === 'takeAway') return `− ${e.amount}`
  return null
})

const ariaLabel = computed(() => {
  const parts = []
  for (const item of props.items) {
    const n = props.scale.counts[item]
    if (n) parts.push(`${n} ${ITEMS[item][props.theme === 'letters' ? 'en' : 'zh']}`)
  }
  for (const b of props.scale.blocks) parts.push(String(b))
  return `${t('level.clue', { id: props.scale.id })}: ${parts.join(' + ')} = ${props.scale.right}`
})

function take(piece) {
  if (props.takeable && piece.kind === 'block') emit('take', piece.index)
}
</script>

<template>
  <svg class="scale-svg" viewBox="0 30 380 220" role="img" :aria-label="ariaLabel">
    <!-- 刻度盘 -->
    <path class="dial" d="M 158 102.6 A 64 64 0 0 1 222 102.6" />
    <line class="dial-mark" x1="190" y1="86" x2="190" y2="101" />

    <!-- 桌面和支架 -->
    <rect class="table" x="6" y="243" width="368" height="7" rx="3.5" />
    <path class="base" d="M 138 244 Q 138 232 150 232 L 230 232 Q 242 232 242 244 Z" />
    <rect class="post" x="184" :y="CY" width="12" :height="232 - CY" rx="4" />

    <!-- 横梁和指针（一起转） -->
    <g :transform="`rotate(${angle} ${CX} ${CY})`">
      <line class="needle" :x1="CX" :y1="CY" :x2="CX" :y2="CY - 54" />
      <rect class="beam" :x="CX - ARM - 8" :y="CY - 5" :width="ARM * 2 + 16" height="10" rx="5" />
      <circle class="beam-cap" :cx="CX - ARM" :cy="CY" r="6" />
      <circle class="beam-cap" :cx="CX + ARM" :cy="CY" r="6" />
    </g>
    <circle class="pivot" :cx="CX" :cy="CY" r="10" />
    <circle class="pivot-dot" :cx="CX" :cy="CY" r="3.5" />

    <!-- 左盘 -->
    <g :transform="`translate(${leftEnd.x} ${leftEnd.y})`">
      <line class="stem" x1="0" y1="0" x2="0" :y2="PLATE_TOP + 6" />
      <rect class="plate" x="-70" :y="PLATE_TOP" width="140" height="8" rx="4" />
      <TransitionGroup tag="g" name="piece" appear :duration="{ enter: 380, leave: 320 }">
        <g
          v-for="p in placed"
          :key="p.key"
          class="piece"
          :class="{ takeable: takeable && p.kind === 'block', pulse: p.kind === 'block' && p.index === pulseBlock }"
          :style="{ transform: `translate(${p.x}px, ${p.y}px)` }"
          @click="take(p)"
        >
          <g class="piece-inner">
            <template v-if="p.kind === 'item'">
              <template v-if="ITEMS[p.item].letter">
                <rect class="letter-box" :x="-14 * p.shrink" :y="-14 * p.shrink" :width="28 * p.shrink" :height="28 * p.shrink" rx="7" :style="{ fill: ITEMS[p.item].color }" />
                <text class="letter" :font-size="22 * p.shrink" y="1">{{ ITEMS[p.item].letter }}</text>
              </template>
              <text v-else class="emoji" :font-size="28 * p.shrink" y="2">{{ ITEMS[p.item].emoji }}</text>
            </template>
            <template v-else>
              <path
                class="weight"
                :d="`M ${-15 * p.shrink} ${-10 * p.shrink} L ${15 * p.shrink} ${-10 * p.shrink} L ${20 * p.shrink} ${16 * p.shrink} L ${-20 * p.shrink} ${16 * p.shrink} Z`"
              />
              <path class="weight-handle" :d="`M ${-6 * p.shrink} ${-10 * p.shrink} Q 0 ${-19 * p.shrink} ${6 * p.shrink} ${-10 * p.shrink}`" />
              <text class="weight-text" :font-size="(p.value >= 10 ? 13 : 15) * p.shrink" :y="4 * p.shrink">{{ p.value }}</text>
            </template>
          </g>
        </g>
      </TransitionGroup>
      <text v-if="floatLabel" :key="`fl-${event.key}`" class="float-label" x="0" :y="PLATE_TOP - 70">{{ floatLabel }}</text>
    </g>

    <!-- 右盘 -->
    <g :transform="`translate(${rightEnd.x} ${rightEnd.y})`">
      <line class="stem" x1="0" y1="0" x2="0" :y2="PLATE_TOP + 6" />
      <rect class="plate" x="-70" :y="PLATE_TOP" width="140" height="8" rx="4" />
      <g class="piece" :style="{ transform: `translate(0px, ${PLATE_TOP - 24}px)` }">
        <g :key="`r-${scale.right}`" class="piece-inner bump">
          <path class="weight big" d="M -24 -16 L 24 -16 L 31 24 L -31 24 Z" />
          <path class="weight-handle big" d="M -9 -16 Q 0 -30 9 -16" />
          <text class="weight-text" :font-size="theme === 'shop' ? 15 : money(scale.right).length > 2 ? 17 : 21" y="6">{{ money(scale.right) }}</text>
        </g>
      </g>
      <text v-if="floatLabel" :key="`fr-${event.key}`" class="float-label" x="0" :y="PLATE_TOP - 70">{{ floatLabel }}</text>
    </g>
  </svg>
</template>

<style scoped>
.scale-svg {
  display: block;
  width: 100%;
  max-width: 460px;
  margin-inline: auto;
  height: auto;
  overflow: visible;
  user-select: none;
  -webkit-user-select: none;
}
.dial {
  fill: none;
  stroke: var(--paper-line);
  stroke-width: 6;
  stroke-linecap: round;
}
.dial-mark {
  stroke: var(--leaf);
  stroke-width: 4;
  stroke-linecap: round;
}
.table {
  fill: #dcae7a;
}
.base {
  fill: var(--brass-dark);
}
.post {
  fill: var(--brass);
}
.beam {
  fill: var(--brass);
  stroke: var(--brass-dark);
  stroke-width: 2;
}
.beam-cap,
.pivot {
  fill: var(--brass-dark);
}
.pivot-dot {
  fill: var(--brass-light);
}
.needle {
  stroke: var(--berry);
  stroke-width: 4;
  stroke-linecap: round;
}
.stem {
  stroke: var(--brass-dark);
  stroke-width: 5;
  stroke-linecap: round;
}
.plate {
  fill: var(--brass);
  stroke: var(--brass-dark);
  stroke-width: 2;
}
.piece {
  transition: transform 0.35s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.piece-inner {
  transform-box: fill-box;
  transform-origin: center;
}
.emoji {
  font-family: var(--emoji);
  text-anchor: middle;
  dominant-baseline: central;
}
.letter-box {
  stroke: rgba(29, 47, 79, 0.35);
  stroke-width: 2;
}
.letter {
  font-family: var(--font);
  font-weight: 700;
  font-style: italic;
  fill: #fff;
  text-anchor: middle;
  dominant-baseline: central;
}
.weight {
  fill: var(--iron);
  stroke: #27324a;
  stroke-width: 1.5;
  stroke-linejoin: round;
}
.weight-handle {
  fill: none;
  stroke: #27324a;
  stroke-width: 3.5;
  stroke-linecap: round;
}
.weight-text {
  font-family: var(--font);
  font-weight: 700;
  fill: #fff;
  text-anchor: middle;
  dominant-baseline: central;
  font-variant-numeric: tabular-nums;
}
.takeable {
  cursor: pointer;
}
.takeable .weight {
  stroke: var(--sun);
  stroke-width: 3;
}
.pulse .piece-inner {
  animation: pulse-piece 1.1s ease-in-out infinite;
}
.float-label {
  font-family: var(--font);
  font-weight: 700;
  font-size: 26px;
  fill: var(--coral);
  stroke: #fff;
  stroke-width: 5px;
  paint-order: stroke;
  text-anchor: middle;
  animation: float-up 1.4s ease-out forwards;
}
.bump {
  animation: bump 0.45s ease-out;
}
.piece-enter-active .piece-inner {
  animation: pop-in 0.38s cubic-bezier(0.3, 1.6, 0.5, 1);
}
.piece-leave-active .piece-inner {
  animation: pop-out 0.32s ease-in forwards;
}
@keyframes pop-in {
  from {
    transform: scale(0);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
}
@keyframes pop-out {
  to {
    transform: translateY(-30px) scale(0.3);
    opacity: 0;
  }
}
@keyframes bump {
  40% {
    transform: scale(1.18);
  }
}
@keyframes pulse-piece {
  50% {
    transform: scale(1.18);
  }
}
@keyframes float-up {
  0% {
    opacity: 0;
    transform: translateY(12px);
  }
  20% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translateY(-26px);
  }
}
</style>
