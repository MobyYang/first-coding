<script setup>
// 题库：更多练习题。每一课都能一直做新题，不用先看例题；做完一题点“下一题”，想停就停。
// 每课做了几道、几道一次做对，记在这台设备上。
import { LESSONS } from '../core/lessons.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { bankOf } from '../store.js'

const emit = defineEmits(['open', 'back'])

function open(lesson) {
  play('tap')
  emit('open', lesson.id)
}
</script>

<template>
  <div class="page bank">
    <header class="page-top">
      <button type="button" class="btn btn-soft btn-small" @click="emit('back')">← {{ t('top.home') }}</button>
      <h1 class="page-title">📚 {{ t('bank.title') }}</h1>
    </header>
    <p class="bank-intro">{{ t('bank.intro') }}</p>

    <ol class="bank-list">
      <li v-for="lesson in LESSONS" :key="lesson.id">
        <button type="button" class="bank-card" @click="open(lesson)">
          <span class="bank-number">{{ lesson.id }}</span>
          <span class="bank-body">
            <span class="bank-title">{{ t('home.lesson', { n: lesson.id }) }} · {{ t(`lesson.${lesson.id}.title`) }}</span>
            <span class="bank-count" :class="{ none: !bankOf(lesson.id).done }">
              {{ bankOf(lesson.id).done ? t('bank.done', { n: bankOf(lesson.id).done, right: bankOf(lesson.id).right }) : t('bank.none') }}
            </span>
          </span>
          <span class="bank-go">{{ t('bank.start') }} ▶</span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.bank-intro {
  margin: 0;
  font-size: clamp(1.1rem, 2.6vw, 1.25rem);
  font-weight: 600;
  line-height: 1.55;
  color: var(--ink);
}
.bank-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 10px;
}
.bank-card {
  width: 100%;
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 14px;
  padding: 12px 16px;
  border: 3px solid transparent;
  border-radius: 20px;
  background: var(--paper);
  box-shadow: var(--shadow);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.bank-card:focus-visible {
  border-color: var(--teal);
}
.bank-number {
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--teal-soft);
  color: var(--teal);
  font-size: 1.35rem;
  font-weight: 700;
}
.bank-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.bank-title {
  font-size: 1.25rem;
  font-weight: 700;
}
.bank-count {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--leaf);
}
.bank-count.none {
  color: var(--ink-soft);
}
.bank-go {
  padding: 8px 14px;
  border-radius: 12px;
  background: var(--coral);
  color: #fff;
  font-weight: 700;
  white-space: nowrap;
}
</style>
