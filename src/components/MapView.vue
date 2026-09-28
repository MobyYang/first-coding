<script setup>
// 闯关地图：五个章节，每关一个圆形“案件章”，拿到星星解锁下一关
import { computed } from 'vue'
import OwlSays from './OwlSays.vue'
import { LEVELS, WORLDS } from '../core/levels.js'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { isUnlocked, nextLevelToPlay, progress, setLang, starsOf, totalStars } from '../store.js'

const emit = defineEmits(['play', 'stickers', 'settings'])

const next = computed(() => nextLevelToPlay())
const started = computed(() => Object.keys(progress.levels).length > 0)

function open(level) {
  if (!isUnlocked(level.id)) {
    play('wrong')
    return
  }
  play('tap')
  emit('play', level.id)
}

function toggleLang() {
  setLang(progress.settings.lang === 'zh' ? 'en' : 'zh')
  play('tap')
}
</script>

<template>
  <div class="map">
    <header class="map-top">
      <button type="button" class="btn btn-soft btn-small" :aria-label="t('settings.lang')" @click="toggleLang">
        {{ progress.settings.lang === 'zh' ? 'EN' : '中文' }}
      </button>
      <div class="map-top-right">
        <button type="button" class="btn btn-soft btn-small" @click="emit('stickers')">🏅 <span class="hide-narrow">{{ t('map.stickers') }}</span></button>
        <button type="button" class="btn btn-soft btn-small" :aria-label="t('map.settings')" @click="emit('settings')">⚙️ <span class="hide-narrow">{{ t('map.settings') }}</span></button>
      </div>
    </header>

    <section class="hero">
      <h1 class="hero-title">{{ t('app.title') }}</h1>
      <p class="hero-tagline">{{ t('app.tagline') }}</p>
      <OwlSays class="hero-owl" :text="next ? t('map.welcome') : t('map.allDone')" mood="happy" :size="84" />
      <div class="hero-actions">
        <span class="star-chip">★ {{ t('map.stars', { n: totalStars(), total: LEVELS.length * 3 }) }}</span>
        <button v-if="next" type="button" class="btn btn-primary btn-large" @click="open(next)">
          {{ started ? t('map.continue') : t('map.start') }} · {{ next.id }} ▶
        </button>
      </div>
    </section>

    <ol class="worlds">
      <li v-for="(world, wi) in WORLDS" :key="world.id" class="world" :class="`world-${world.id}`">
        <div class="world-head">
          <span class="world-badge" aria-hidden="true">{{ world.emoji }}</span>
          <div>
            <p class="world-number">{{ t('map.world', { n: wi + 1 }) }}</p>
            <h2 class="world-title">{{ t(`world.${world.id}`) }}</h2>
            <p class="world-desc">{{ t(`world.${world.id}.desc`) }}</p>
          </div>
        </div>
        <ol class="level-row">
          <li v-for="level in world.levels" :key="level.id" class="level-node">
            <button
              type="button"
              class="node"
              :class="{ locked: !isUnlocked(level.id), done: starsOf(level.id) > 0, current: next && next.id === level.id }"
              :aria-label="`${level.id} ${t(`level.${level.id}`)}${isUnlocked(level.id) ? '' : ' · ' + t('map.locked')}`"
              @click="open(level)"
            >
              <span v-if="!isUnlocked(level.id)" aria-hidden="true">🔒</span>
              <span v-else>{{ level.id }}</span>
            </button>
            <span class="node-title">{{ t(`level.${level.id}`) }}</span>
            <span class="node-stars" :aria-label="`${starsOf(level.id)} / 3`">
              <span v-for="i in 3" :key="i" :class="{ on: i <= starsOf(level.id) }">★</span>
            </span>
          </li>
        </ol>
      </li>
    </ol>
  </div>
</template>

<style scoped>
.map {
  display: grid;
  gap: 18px;
  padding-block: 12px 32px;
}
.map-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.map-top-right {
  display: flex;
  gap: 8px;
}
.hero {
  display: grid;
  justify-items: center;
  gap: 10px;
  padding: 8px 0 4px;
  text-align: center;
}
.hero-title {
  margin: 0;
  font-size: clamp(2.3rem, 7vw, 3.6rem);
  line-height: 1.05;
  letter-spacing: 0.02em;
  color: var(--ink);
  text-shadow: 0 4px 0 #fff;
  text-wrap: balance;
}
.hero-tagline {
  margin: 0;
  font-size: 1.1rem;
  font-weight: 600;
  color: var(--ink-soft);
}
.hero-owl {
  max-width: 560px;
  text-align: left;
}
.hero-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  gap: 12px;
}
.star-chip {
  padding: 8px 14px;
  border-radius: 999px;
  background: #fff;
  color: #9a6b00;
  font-weight: 700;
  box-shadow: 0 3px 0 var(--paper-line);
}
.worlds {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  gap: 16px;
  max-width: 760px;
  width: 100%;
  margin-inline: auto;
}
.world {
  --accent: var(--coral);
  --accent-soft: #ffe3da;
  padding: 16px;
  border-radius: 26px;
  background: var(--paper);
  box-shadow: var(--shadow);
  border-top: 8px solid var(--accent);
}
.world-camp {
  --accent: #e9a91c;
  --accent-soft: #fff0c7;
}
.world-fruit {
  --accent: var(--coral);
  --accent-soft: #ffe3da;
}
.world-compare {
  --accent: var(--teal);
  --accent-soft: var(--teal-soft);
}
.world-story {
  --accent: var(--leaf);
  --accent-soft: var(--leaf-soft);
}
.world-letters {
  --accent: #3b5b92;
  --accent-soft: #dfe7f6;
}
.world-head {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-bottom: 12px;
}
.world-badge {
  flex: none;
  display: grid;
  place-items: center;
  width: 58px;
  height: 58px;
  border-radius: 18px;
  background: var(--accent-soft);
  font-family: var(--emoji);
  font-size: 2rem;
}
.world-number {
  margin: 0;
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--accent);
}
.world-title {
  margin: 0;
  font-size: 1.4rem;
}
.world-desc {
  margin: 2px 0 0;
  color: var(--ink-soft);
  font-size: 0.98rem;
}
.level-row {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  position: relative;
}
.level-row::before {
  content: '';
  position: absolute;
  top: 36px;
  left: 16%;
  right: 16%;
  border-top: 4px dashed var(--accent-soft);
}
.level-node {
  position: relative;
  display: grid;
  justify-items: center;
  gap: 4px;
  text-align: center;
}
.node {
  display: grid;
  place-items: center;
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 4px solid var(--accent);
  background: #fff;
  color: var(--accent);
  font: inherit;
  font-size: 1.35rem;
  font-weight: 700;
  box-shadow: 0 4px 0 var(--accent-soft);
  cursor: pointer;
  transition: transform 0.15s;
}
.node:active {
  transform: translateY(3px);
}
.node.done {
  background: var(--accent);
  color: #fff;
}
.node.current {
  animation: bob 1.6s ease-in-out infinite;
  box-shadow: 0 0 0 6px var(--accent-soft), 0 4px 0 var(--accent-soft);
}
.node.locked {
  border-color: var(--paper-line);
  color: var(--ink-soft);
  background: #f6f1e4;
  box-shadow: none;
  cursor: not-allowed;
}
.node-title {
  font-weight: 600;
  font-size: 0.95rem;
  line-height: 1.25;
  text-wrap: balance;
}
.node-stars {
  display: flex;
  gap: 2px;
  font-size: 1rem;
  color: var(--paper-line);
}
.node-stars .on {
  color: var(--sun);
}
@keyframes bob {
  50% {
    transform: translateY(-5px);
  }
}
</style>
