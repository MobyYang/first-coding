<script setup>
// 演算里的一行：2🍎 + 3 − 3 = 11 − 3。
// show：所有数都写出来，算出来的数用绿色标出；do：要孩子填的数变成可以点的空。
import { ITEMS } from '../items.js'

const props = defineProps({
  tokens: { type: Array, required: true },
  mode: { type: String, default: 'show' },
  values: { type: Object, default: () => ({}) },
  wrong: { type: Object, default: () => ({}) },
  active: { type: String, default: null },
  typing: { type: String, default: null },
  next: { type: String, default: null },
})
const emit = defineEmits(['pick'])

function blankState(id) {
  if (id === props.active) return 'active'
  if (props.values[id] != null) return 'filled'
  if (props.wrong[id] != null) return 'wrong'
  return id === props.next ? 'next' : 'empty'
}

function blankText(id) {
  if (id === props.active && props.typing != null) return props.typing === '' ? '?' : props.typing
  return props.values[id] ?? props.wrong[id] ?? '?'
}

const isBlank = (tok) => props.mode === 'do' && tok.blank
</script>

<template>
  <span class="tokens">
    <template v-for="(tok, i) in tokens" :key="i">
      <span v-if="tok.type === 'op'" class="tok-op" :class="{ open: tok.text === '(', close: tok.text === ')' }">{{ tok.text }}</span>

      <span v-else-if="tok.type === 'item'" class="tok-term">
        <button
          v-if="isBlank(tok)"
          type="button"
          class="blank"
          :class="blankState(tok.blank)"
          :aria-label="`${blankText(tok.blank)} ${ITEMS[tok.item].zh}`"
          @click="emit('pick', tok.blank)"
        >
          {{ blankText(tok.blank) }}
        </button>
        <span v-else-if="tok.count > 1" class="tok-num" :class="{ worked: tok.blank }">{{ tok.count }}</span>
        <span v-if="ITEMS[tok.item].letter" class="tok-letter" :style="{ color: ITEMS[tok.item].color }">{{ ITEMS[tok.item].letter }}</span>
        <span v-else class="tok-emoji">{{ ITEMS[tok.item].emoji }}</span>
      </span>

      <button
        v-else-if="isBlank(tok)"
        type="button"
        class="blank"
        :class="blankState(tok.blank)"
        :aria-label="String(blankText(tok.blank))"
        @click="emit('pick', tok.blank)"
      >
        {{ blankText(tok.blank) }}
      </button>

      <span v-else-if="tok.type === 'ref' && mode === 'do'" class="tok-num" :class="{ pending: values[tok.of] == null }">
        {{ values[tok.of] ?? '?' }}
      </span>

      <span v-else class="tok-num" :class="{ worked: tok.blank }">{{ tok.value }}</span>
    </template>
  </span>
</template>

<style scoped>
.tokens {
  display: inline-flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  font-variant-numeric: tabular-nums;
}
.tok-term {
  display: inline-flex;
  align-items: center;
  gap: 1px;
}
.tok-op {
  color: var(--ink-soft);
  font-weight: 600;
}
.tok-op.open {
  margin-right: -6px;
}
.tok-op.close {
  margin-left: -6px;
}
.tok-num {
  font-weight: 700;
}
.tok-num.worked {
  color: var(--leaf);
}
.tok-num.pending {
  color: var(--ink-soft);
}
.tok-emoji {
  font-family: var(--emoji);
}
.tok-letter {
  font-style: italic;
  font-weight: 700;
}
.blank {
  display: inline-grid;
  place-items: center;
  min-width: 2.2em;
  min-height: 1.7em;
  padding: 0 6px;
  border: 3px dashed var(--teal);
  border-radius: 12px;
  background: #fff;
  color: var(--teal);
  font: inherit;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
}
.blank.next {
  animation: blank-pulse 1.4s ease-in-out infinite;
}
.blank.active {
  border-style: solid;
  border-color: var(--sun);
  background: #fff4cc;
  color: var(--ink);
}
.blank.filled {
  border-style: solid;
  border-color: var(--leaf);
  background: var(--leaf-soft);
  color: var(--leaf);
  cursor: default;
}
.blank.wrong {
  border-style: solid;
  border-color: var(--berry);
  background: var(--berry-soft);
  color: var(--berry);
}
@keyframes blank-pulse {
  50% {
    box-shadow: 0 0 0 5px rgba(22, 138, 151, 0.25);
  }
}
@media (prefers-reduced-motion: reduce) {
  .blank.next {
    animation: none;
  }
}
</style>
