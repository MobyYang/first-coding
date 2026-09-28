<script setup>
// 一课学完：星星一颗颗亮起来，显示第一次就答对了几题
import { onBeforeUnmount, onMounted, ref } from 'vue'
import OwlSays from './OwlSays.vue'
import { t } from '../i18n.js'
import { play } from '../sound.js'

const props = defineProps({
  lesson: { type: Object, required: true },
  stars: { type: Number, required: true },
  firstTry: { type: Number, required: true },
  total: { type: Number, required: true },
  hasNext: { type: Boolean, default: false },
})
const emit = defineEmits(['again', 'next', 'home'])

const lit = ref(0)
const timers = []

onMounted(() => {
  play('level')
  for (let i = 1; i <= props.stars; i++) {
    timers.push(
      setTimeout(() => {
        lit.value = i
        play('star')
      }, 350 + i * 380),
    )
  }
})
onBeforeUnmount(() => timers.forEach(clearTimeout))
</script>

<template>
  <div class="result-backdrop">
    <section class="result" role="dialog" aria-modal="true" :aria-label="t('result.title')">
      <p class="result-eyebrow">{{ t('home.lesson', { n: lesson.id }) }} · {{ t(`lesson.${lesson.id}.title`) }}</p>
      <h2 class="result-title">{{ t('result.title') }}</h2>
      <div class="result-stars" :aria-label="`${stars} / 3`">
        <span v-for="i in 3" :key="i" class="result-star" :class="{ on: i <= lit }">★</span>
      </div>
      <p class="result-score">{{ t('result.score', { n: firstTry, total }) }}</p>
      <OwlSays v-if="!hasNext" :text="t('result.allDone')" mood="happy" :size="56" />
      <div class="result-actions">
        <button type="button" class="btn btn-soft" @click="emit('again')">↺ {{ t('result.again') }}</button>
        <button type="button" class="btn btn-soft" @click="emit('home')">{{ t('result.home') }}</button>
        <button v-if="hasNext" type="button" class="btn btn-primary" @click="emit('next')">{{ t('result.next') }} ▶</button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.result-backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(29, 47, 79, 0.4);
  animation: fade 0.2s ease-out;
}
.result {
  width: min(440px, 100%);
  max-height: 100%;
  overflow: auto;
  padding: 24px 20px 20px;
  border-radius: 28px;
  background: var(--paper);
  box-shadow: var(--shadow);
  text-align: center;
  display: grid;
  gap: 12px;
  justify-items: center;
  animation: rise 0.35s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.result-eyebrow {
  margin: 0;
  font-size: 0.95rem;
  letter-spacing: 0.04em;
  color: var(--ink-soft);
}
.result-title {
  margin: 0;
  font-size: 2rem;
}
.result-stars {
  display: flex;
  gap: 8px;
}
.result-star {
  font-size: 3rem;
  line-height: 1;
  color: var(--paper-line);
  transition: transform 0.3s cubic-bezier(0.3, 1.8, 0.5, 1), color 0.2s;
}
.result-star.on {
  color: var(--sun);
  transform: scale(1.15) rotate(-8deg);
  text-shadow: 0 3px 0 #d99a0b;
}
.result-score {
  margin: 0;
  font-size: 1.15rem;
  font-weight: 600;
}
.result-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  margin-top: 4px;
}
@keyframes rise {
  from {
    transform: translateY(30px) scale(0.95);
    opacity: 0;
  }
}
@keyframes fade {
  from {
    opacity: 0;
  }
}
</style>
