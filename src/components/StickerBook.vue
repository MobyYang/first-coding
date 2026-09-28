<script setup>
// 贴纸本：每关一张，三颗星的有金边
import { computed } from 'vue'
import { LEVELS } from '../core/levels.js'
import { t } from '../i18n.js'
import { starsOf } from '../store.js'

const emit = defineEmits(['back'])
const earned = computed(() => LEVELS.filter((level) => starsOf(level.id) > 0).length)
</script>

<template>
  <div class="page">
    <header class="page-top">
      <button type="button" class="btn btn-soft btn-small" @click="emit('back')">← {{ t('common.back') }}</button>
      <h1 class="page-title">🏅 {{ t('stickers.title') }}</h1>
    </header>
    <p class="page-desc">{{ t('stickers.desc') }} {{ t('stickers.count', { n: earned, total: LEVELS.length }) }}</p>
    <ul class="sticker-grid">
      <li v-for="level in LEVELS" :key="level.id" class="sticker" :class="{ earned: starsOf(level.id) > 0, gold: starsOf(level.id) === 3 }">
        <span class="sticker-face" aria-hidden="true">{{ starsOf(level.id) > 0 ? level.sticker : '?' }}</span>
        <span class="sticker-name">{{ level.id }} · {{ t(`level.${level.id}`) }}</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.sticker-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 14px;
}
.sticker {
  display: grid;
  justify-items: center;
  gap: 8px;
  padding: 14px 8px;
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
  text-align: center;
}
.sticker-face {
  display: grid;
  place-items: center;
  width: 84px;
  height: 84px;
  border-radius: 50%;
  background: #f1ebdc;
  color: #c9bfa6;
  font-size: 2.2rem;
  font-weight: 700;
  border: 5px dashed #e3d9c1;
}
.earned .sticker-face {
  background: #fff;
  color: inherit;
  font-family: var(--emoji);
  font-size: 2.9rem;
  border: 5px solid var(--teal-soft);
}
.gold .sticker-face {
  border-color: var(--sun);
  box-shadow: 0 0 0 4px #fff3c4;
}
.sticker-name {
  font-size: 0.9rem;
  font-weight: 600;
  line-height: 1.3;
  color: var(--ink-soft);
}
</style>
