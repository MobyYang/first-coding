<script setup>
// 屏幕数字键盘：用道具时算“20 ÷ 5 = ?”。平板上不弹系统键盘，不会挡住题目。
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { t } from '../i18n.js'
import { play } from '../sound.js'

const props = defineProps({
  expression: { type: String, required: true },
  heading: { type: String, default: '' },
  explain: { type: String, default: '' },
  feedback: { type: String, default: '' },
  attempt: { type: Number, default: 0 },
})
const emit = defineEmits(['done', 'close', 'tip'])

const text = ref('')
const shaking = ref(false)

// 算错了：清空重新输入，键盘抖一下
watch(
  () => props.attempt,
  () => {
    text.value = ''
    shaking.value = false
    requestAnimationFrame(() => (shaking.value = true))
  },
)

function press(digit) {
  play('tap')
  if (text.value.length >= 2) text.value = ''
  text.value = text.value === '0' ? String(digit) : text.value + digit
}

function back() {
  play('tap')
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
    <div class="pad" :class="{ shake: shaking }" role="dialog" aria-modal="true" :aria-label="heading || expression" @animationend="shaking = false">
      <div v-if="heading" class="pad-head">
        <p class="pad-heading">{{ heading }}</p>
        <button type="button" class="pad-close" :aria-label="t('tool.cancel')" @click="emit('close')">✕</button>
      </div>
      <p v-if="explain" class="pad-explain">{{ explain }}</p>
      <div class="pad-display">
        <span class="pad-expr">{{ expression }}</span>
        <span class="pad-eq">=</span>
        <span class="pad-value" :class="{ empty: text === '' }">{{ text === '' ? '?' : text }}</span>
      </div>
      <p v-if="feedback" class="pad-feedback" aria-live="polite">{{ feedback }}</p>
      <div class="pad-grid">
        <button v-for="d in [1, 2, 3, 4, 5, 6, 7, 8, 9]" :key="d" type="button" class="pad-key" @click="press(d)">{{ d }}</button>
        <button type="button" class="pad-key soft" aria-label="⌫" @click="back">⌫</button>
        <button type="button" class="pad-key" @click="press(0)">0</button>
        <button type="button" class="pad-key ok" aria-label="OK" @click="done">✓</button>
      </div>
      <button type="button" class="pad-tip" @click="emit('tip')">💡 {{ t('calc.tipButton') }}</button>
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
  width: min(380px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 16px;
  border-radius: 24px;
  background: var(--paper);
  box-shadow: var(--shadow);
  animation: slide-up 0.22s cubic-bezier(0.3, 1.3, 0.5, 1);
}
.pad.shake {
  animation: shake 0.4s ease-in-out;
}
.pad-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.pad-heading {
  margin: 0;
  font-weight: 700;
  color: #0d5f68;
}
.pad-close {
  width: 40px;
  height: 40px;
  border: 0;
  border-radius: 12px;
  background: #f1ebdc;
  color: var(--ink-soft);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}
.pad-explain {
  margin: 8px 0 0;
  line-height: 1.5;
  color: var(--ink);
  text-wrap: pretty;
}
.pad-display {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 10px;
  margin: 12px 0;
  font-size: 2.1rem;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
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
}
.pad-value.empty {
  color: var(--ink-soft);
}
.pad-feedback {
  margin: 0 0 12px;
  padding: 8px 12px;
  border-radius: 12px;
  background: #fff1cc;
  color: #7a5200;
  font-weight: 600;
  text-align: center;
  line-height: 1.45;
}
.pad-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.pad-key {
  min-height: 58px;
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
.pad-tip {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: 12px;
  border: 0;
  border-radius: 14px;
  background: #fff1cc;
  color: #7a5200;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
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
@keyframes shake {
  20%,
  60% {
    transform: translateX(-8px);
  }
  40%,
  80% {
    transform: translateX(8px);
  }
}
</style>
