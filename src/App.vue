<script setup>
import { computed, ref, watchEffect } from 'vue'
import HomeView from './components/HomeView.vue'
import LessonView from './components/LessonView.vue'
import SettingsView from './components/SettingsView.vue'
import { LESSONS, findLesson } from './core/lessons.js'
import { unlockAudio } from './sound.js'
import { progress } from './store.js'
import { unlockVoice } from './voice.js'

const screen = ref('home')
const lessonId = ref(null)
const playKey = ref(0)

const lesson = computed(() => findLesson(lessonId.value))
const nextLesson = computed(() => {
  const i = LESSONS.findIndex((l) => l.id === lessonId.value)
  return i >= 0 ? LESSONS[i + 1] || null : null
})

watchEffect(() => {
  document.documentElement.lang = progress.settings.lang === 'zh' ? 'zh-CN' : 'en'
})

function go(name) {
  screen.value = name
  window.scrollTo({ top: 0 })
}

function openLesson(id) {
  lessonId.value = id
  playKey.value++
  go('lesson')
}

function again() {
  playKey.value++
  window.scrollTo({ top: 0 })
}

function next() {
  if (nextLesson.value) openLesson(nextLesson.value.id)
  else go('home')
}
</script>

<template>
  <main class="app" @pointerdown.capture="unlockAudio" @click.capture="unlockVoice">
    <HomeView v-if="screen === 'home'" @open="openLesson" @settings="go('settings')" />
    <LessonView
      v-else-if="screen === 'lesson' && lesson"
      :key="playKey"
      :lesson="lesson"
      :has-next="Boolean(nextLesson)"
      @home="go('home')"
      @again="again"
      @next="next"
    />
    <SettingsView v-else-if="screen === 'settings'" @back="go('home')" />
  </main>
</template>
