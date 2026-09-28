<script setup>
// 把一架天平写成算式：2🍎 + 🍌 + 9 = 13（第 5 章写成 2x + y + 9 = 13）
import { computed } from 'vue'
import { ITEMS, equationParts } from '../items.js'
import { t } from '../i18n.js'

const props = defineProps({
  scale: { type: Object, required: true },
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
})

const parts = computed(() => equationParts(props.scale, props.items))

function money(value) {
  return props.theme === 'shop' ? t('level.yuan', { v: value }) : value
}
</script>

<template>
  <p class="equation">
    <template v-for="(part, i) in parts.left" :key="i">
      <span v-if="i > 0" class="op">+</span>
      <span v-if="part.kind === 'term'" class="term">
        <span v-if="part.count > 1" class="coef">{{ part.count }}</span>
        <span v-if="ITEMS[part.item].letter" class="letter" :style="{ color: ITEMS[part.item].color }">{{ ITEMS[part.item].letter }}</span>
        <span v-else class="emoji">{{ ITEMS[part.item].emoji }}</span>
      </span>
      <span v-else class="num">{{ money(part.value) }}</span>
    </template>
    <span class="op">=</span>
    <span class="num">{{ money(parts.right) }}</span>
  </p>
</template>

<style scoped>
.equation {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 4px 8px;
  margin: 0;
  font-size: 1.35rem;
  font-weight: 600;
  color: var(--ink);
  font-variant-numeric: tabular-nums;
}
.term {
  display: inline-flex;
  align-items: center;
}
.coef {
  margin-right: 1px;
}
.emoji {
  font-family: var(--emoji);
  font-size: 1.25rem;
}
.letter {
  font-style: italic;
  font-weight: 700;
  font-size: 1.45rem;
}
.op {
  color: var(--ink-soft);
}
</style>
