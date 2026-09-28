<script setup>
// 课程表：7 节课按顺序排好，每节都能直接点开
import { computed } from 'vue'
import EquationLine from './EquationLine.vue'
import OwlSays from './OwlSays.vue'
import { buildPuzzle } from '../core/generator.js'
import { LESSONS } from '../core/lessons.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { nextLesson, starsOf } from '../store.js'

const emit = defineEmits(['open', 'settings'])

const next = computed(() => nextLesson())
const examples = Object.fromEntries(
  LESSONS.map((lesson) => {
    const { items, values, clues } = lesson.example
    return [lesson.id, buildPuzzle(lesson.template, values, clues, items)]
  }),
)

function open(lesson) {
  play('tap')
  emit('open', lesson.id)
}
</script>

<template>
  <div class="home">
    <header class="home-top">
      <button type="button" class="btn btn-soft btn-small" @click="emit('settings')">⚙️ {{ t('home.settings') }}</button>
    </header>

    <section class="hero">
      <h1 class="hero-title">{{ t('app.title') }}</h1>
      <p class="hero-tagline">{{ t('app.tagline') }}</p>
      <OwlSays class="hero-owl" :text="t('home.hello')" mood="happy" :size="80" />
    </section>

    <ol class="lessons">
      <li v-for="lesson in LESSONS" :key="lesson.id">
        <button type="button" class="lesson-card" :class="{ current: next && next.id === lesson.id, done: starsOf(lesson.id) > 0 }" @click="open(lesson)">
          <span class="lesson-number">{{ lesson.id }}</span>
          <span class="lesson-body">
            <span class="lesson-title">{{ t(`lesson.${lesson.id}.title`) }}</span>
            <span class="lesson-goal">{{ t(`lesson.${lesson.id}.goal`) }}</span>
            <span class="lesson-example">
              <EquationLine v-for="scale in examples[lesson.id].board.scales" :key="scale.id" :scale="scale" :items="examples[lesson.id].items" :theme="lesson.theme" />
            </span>
          </span>
          <span class="lesson-side">
            <span class="lesson-stars" :aria-label="`${starsOf(lesson.id)} / 3`">
              <span v-for="i in 3" :key="i" :class="{ on: i <= starsOf(lesson.id) }">★</span>
            </span>
            <span class="lesson-go">{{ starsOf(lesson.id) > 0 ? t('home.review') : t('home.start') }}</span>
          </span>
        </button>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.home {
  display: grid;
  gap: 16px;
  max-width: 760px;
  margin-inline: auto;
  padding-block: 12px 32px;
}
.home-top {
  display: flex;
  justify-content: flex-end;
}
.hero {
  display: grid;
  justify-items: center;
  gap: 8px;
  text-align: center;
}
.hero-title {
  margin: 0;
  font-size: clamp(2.2rem, 7vw, 3.2rem);
  line-height: 1.1;
  text-shadow: 0 4px 0 #fff;
}
.hero-tagline {
  margin: 0;
  font-size: 1.3rem;
  font-weight: 600;
  color: var(--ink-soft);
}
.hero-owl {
  max-width: 560px;
  text-align: left;
}
.lessons {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 12px;
}
.lesson-card {
  width: 100%;
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: 14px;
  padding: 14px 16px;
  border: 3px solid transparent;
  border-radius: 22px;
  background: var(--paper);
  box-shadow: var(--shadow);
  color: var(--ink);
  font: inherit;
  text-align: left;
  cursor: pointer;
}
.lesson-card.current {
  border-color: var(--coral);
}
.lesson-number {
  display: grid;
  place-items: center;
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--teal-soft);
  color: var(--teal);
  font-size: 1.5rem;
  font-weight: 700;
}
.done .lesson-number {
  background: var(--leaf);
  color: #fff;
}
.current .lesson-number {
  background: var(--coral);
  color: #fff;
}
.lesson-body {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.lesson-title {
  font-size: 1.45rem;
  font-weight: 700;
}
.lesson-goal {
  color: var(--ink);
  font-size: 1.2rem;
  font-weight: 500;
  line-height: 1.5;
}
.lesson-example {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 16px;
  margin-top: 2px;
}
.lesson-example :deep(.equation) {
  justify-content: flex-start;
  font-size: 1.15rem;
}
.lesson-side {
  display: grid;
  justify-items: end;
  gap: 4px;
}
.lesson-stars {
  display: flex;
  gap: 1px;
  color: var(--paper-line);
}
.lesson-stars .on {
  color: var(--sun);
}
.lesson-go {
  padding: 6px 12px;
  border-radius: 12px;
  background: var(--teal-soft);
  color: #0d5f68;
  font-weight: 700;
  white-space: nowrap;
}
.current .lesson-go {
  background: var(--coral);
  color: #fff;
}
@media (max-width: 460px) {
  .lesson-card {
    grid-template-columns: auto 1fr;
  }
  .lesson-side {
    grid-column: 1 / -1;
    grid-auto-flow: column;
    justify-content: space-between;
    align-items: center;
  }
}
</style>
