<script setup>
// 屏幕数字键盘：填演算里的空。平板上不弹系统键盘，不会挡住题目。
// 上面默认显示“🍎 = ?”；用 display 插槽可以换成正在填的那一行算式。
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { play } from '../sound.js'

const props = defineProps({
  label: { type: String, required: true },
  letter: { type: Boolean, default: false },
  initial: { type: Number, default: null },
})
const emit = defineEmits(['done', 'close'])

const text = ref(props.initial == null ? '' : String(props.initial))
// 已经填过的数字：按第一个数字时直接换掉，不接在后面
let replace = props.initial != null

function press(digit) {
  play('tap')
  if (replace || text.value.length >= 2) text.value = ''
  replace = false
  text.value = text.value === '0' ? String(digit) : text.value + digit
}

function back() {
  play('tap')
  replace = false
  text.value = text.value.slice(0, -1)
}

function done() {
  emit('done', text.value === '' ? null : Number(text.value))
}

function onKey(e) {
  if (/^[0-9]$/.test(e.key)) press(Number(e.key))
  else if (e.key === 'Backspace') back()
  else if (e.key === 'Enter') done()
  else if (e.key === 'Escape') emit('close')
  else return
  e.preventDefault()
}

onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))
</script>

<template>
  <div class="pad-backdrop" @click.self="emit('close')">
    <div class="pad" role="dialog" aria-modal="true" :aria-label="label">
      <div class="pad-display">
        <slot name="display" :text="text">
          <span class="pad-item" :class="{ letter }">{{ label }}</span>
          <span class="pad-eq">=</span>
          <span class="pad-value" :class="{ empty: text === '' }">{{ text === '' ? '?' : text }}</span>
        </slot>
      </div>
      <div class="pad-grid">
        <button v-for="d in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="d" type="button" class="pad-key" @click="press(d)">{{ d }}</button>
        <button type="button" class="pad-key soft" aria-label="⌫" @click="back">⌫</button>
        <button type="button" class="pad-key" @click="press(0)">0</button>
        <button type="button" class="pad-key ok" aria-label="OK" @click="done">✓</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pad-backdrop {
  position: fixed;
  inset: 0;
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  background: rgba(29, 47, 79, 0.35);
  animation: fade-in 0.15s ease-out;
}
.pad {
  width: min(360px, 100%);
  padding: 16px;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
  animation: slide-up 0.22s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.pad-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-bottom: 14px;
  font-size: 2.2rem;
  font-weight: 700;
}
.pad-item {
  font-family: var(--emoji);
}
.pad-item.letter {
  font-family: var(--font);
  font-style: italic;
  color: var(--teal);
}
.pad-eq {
  color: var(--ink-soft);
}
.pad-value {
  min-width: 2.4em;
  padding: 2px 12px;
  border-radius: 14px;
  background: var(--teal-soft);
  color: var(--teal);
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.pad-value.empty {
  color: var(--ink-soft);
}
.pad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.pad-key {
  min-height: 60px;
  border: 0;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 4px 0 var(--paper-line);
  font: inherit;
  font-size: 1.7rem;
  font-weight: 600;
  color: var(--ink);
  cursor: pointer;
}
.pad-key:active {
  transform: translateY(3px);
  box-shadow: 0 1px 0 var(--paper-line);
}
.pad-key.soft {
  color: var(--ink-soft);
}
.pad-key.ok {
  background: var(--leaf);
  box-shadow: 0 4px 0 #17794a;
  color: #fff;
}
@keyframes slide-up {
  from {
    transform: translateY(40px);
    opacity: 0;
  }
}
@keyframes fade-in {
  from {
    opacity: 0;
  }
}
</style>
