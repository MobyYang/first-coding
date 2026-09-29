<script setup>
// 设置 + 给家长的说明
import { ref } from 'vue'
import { t } from '../i18n.js'
import { play } from '../sound.js'
import { progress, resetProgress, setLang as chooseLang } from '../store.js'
import { say, toggleVoice } from '../voice.js'

const emit = defineEmits(['back'])
const confirming = ref(false)
const cleared = ref(false)

function setLang(lang) {
  chooseLang(lang)
  play('tap')
}

function toggleSound() {
  progress.settings.sound = !progress.settings.sound
  play('tap')
}

// 打开老师讲解时，老师说一句话，听听是什么声音
function switchVoice() {
  play('tap')
  if (toggleVoice()) say(t('home.hello'))
}

function onReset() {
  if (!confirming.value) {
    confirming.value = true
    cleared.value = false
    return
  }
  resetProgress()
  confirming.value = false
  cleared.value = true
}

// 每课的方法对应课本里的哪种方法
const METHODS = [
  { lessons: '1', method: 'parents.share' },
  { lessons: '2', method: 'parents.takeAway' },
  { lessons: '3', method: 'parents.swap' },
  { lessons: '4', method: 'parents.subtract' },
  { lessons: '5', method: 'parents.add' },
]
</script>

<template>
  <div class="page">
    <header class="page-top">
      <button type="button" class="btn btn-soft btn-small" @click="emit('back')">← {{ t('common.back') }}</button>
      <h1 class="page-title">⚙️ {{ t('settings.title') }}</h1>
    </header>

    <section class="panel">
      <div class="setting">
        <span class="setting-name">{{ t('settings.lang') }}</span>
        <div class="segmented" role="group" :aria-label="t('settings.lang')">
          <button type="button" :class="{ on: progress.settings.lang === 'zh' }" :aria-pressed="progress.settings.lang === 'zh'" @click="setLang('zh')">中文</button>
          <button type="button" :class="{ on: progress.settings.lang === 'en' }" :aria-pressed="progress.settings.lang === 'en'" @click="setLang('en')">English</button>
        </div>
      </div>
      <div class="setting">
        <span class="setting-name">{{ t('settings.sound') }}</span>
        <button type="button" class="switch" :class="{ on: progress.settings.sound }" role="switch" :aria-checked="progress.settings.sound" @click="toggleSound">
          {{ progress.settings.sound ? `🔊 ${t('settings.on')}` : `🔇 ${t('settings.off')}` }}
        </button>
      </div>
      <div class="setting">
        <span class="setting-name">
          {{ t('settings.voice') }}
          <small class="setting-note">{{ t('settings.voiceNote') }}</small>
        </span>
        <button type="button" class="switch" :class="{ on: progress.settings.voice }" role="switch" :aria-checked="progress.settings.voice" @click="switchVoice">
          {{ progress.settings.voice ? `🗣️ ${t('settings.on')}` : `🔇 ${t('settings.off')}` }}
        </button>
      </div>
      <div class="setting">
        <span class="setting-name">{{ t('settings.reset') }}</span>
        <button type="button" class="btn btn-small" :class="confirming ? 'btn-danger' : 'btn-soft'" @click="onReset">
          {{ confirming ? t('settings.resetConfirm') : cleared ? `✓ ${t('settings.resetDone')}` : t('settings.reset') }}
        </button>
      </div>
      <p class="note">{{ t('settings.saved') }}</p>
    </section>

    <section class="panel parents">
      <h2>👪 {{ t('parents.title') }}</h2>
      <p>{{ t('parents.p1') }}</p>
      <p>{{ t('parents.p2') }}</p>
      <ul class="method-map">
        <li v-for="row in METHODS" :key="row.lessons">
          <span class="method-lesson">{{ t('home.lesson', { n: row.lessons }) }} · {{ t(`lesson.${row.lessons}.title`) }}</span>
          <span class="method-arrow" aria-hidden="true">→</span>
          <span>{{ t(row.method) }}</span>
        </li>
      </ul>
      <p>{{ t('parents.p3') }}</p>
    </section>
  </div>
</template>

<style scoped>
.panel {
  display: grid;
  gap: 4px;
  padding: 8px 16px 14px;
  border-radius: 22px;
  background: var(--paper);
  box-shadow: var(--shadow);
}
.setting {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 12px 0;
  border-bottom: 2px solid var(--paper-line);
}
.setting-name {
  flex: 1 1 220px;
  font-weight: 600;
  font-size: 1.05rem;
}
.setting-note {
  display: block;
  margin-top: 2px;
  font-size: 0.9rem;
  font-weight: 400;
  line-height: 1.45;
  color: var(--ink-soft);
}
.segmented {
  display: inline-flex;
  padding: 4px;
  border-radius: 14px;
  background: #f1ebdc;
}
.segmented button,
.switch {
  min-height: 44px;
  padding: 6px 16px;
  border: 0;
  border-radius: 11px;
  background: transparent;
  font: inherit;
  font-weight: 600;
  color: var(--ink-soft);
  cursor: pointer;
}
.segmented button.on {
  background: #fff;
  color: var(--ink);
  box-shadow: 0 2px 0 var(--paper-line);
}
.switch {
  background: #f1ebdc;
}
.switch.on {
  background: var(--leaf-soft);
  color: var(--leaf);
}
.note {
  margin: 10px 0 0;
  font-size: 1.02rem;
  color: var(--ink-soft);
  line-height: 1.5;
}
.parents h2 {
  margin: 8px 0 4px;
  font-size: 1.3rem;
}
.parents p {
  margin: 6px 0;
  font-size: 1.15rem;
  line-height: 1.65;
  max-width: 65ch;
}
.method-map {
  list-style: none;
  margin: 4px 0;
  padding: 0;
  display: grid;
  gap: 8px;
}
.method-map li {
  display: grid;
  grid-template-columns: minmax(9em, auto) auto 1fr;
  font-size: 1.1rem;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 12px;
  background: var(--teal-soft);
}
.method-lesson {
  font-weight: 700;
  color: #0d5f68;
}
.method-arrow {
  color: var(--ink-soft);
}
@media (max-width: 460px) {
  .method-map li {
    grid-template-columns: 1fr;
    gap: 2px;
  }
  .method-arrow {
    display: none;
  }
}
</style>
