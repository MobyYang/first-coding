<script setup>
import { computed, ref, watchEffect } from 'vue'
import CageLevel from './components/CageLevel.vue'
import MapView from './components/MapView.vue'
import ScalesLevel from './components/ScalesLevel.vue'
import SettingsView from './components/SettingsView.vue'
import StickerBook from './components/StickerBook.vue'
import { LEVELS, findLevel, levelIndex } from './core/levels.js'
import { unlockAudio } from './sound.js'
import { progress } from './store.js'

const screen = ref('map')
const levelId = ref(null)
const playKey = ref(0)

const level = computed(() => findLevel(levelId.value))
const nextLevel = computed(() => (levelId.value ? LEVELS[levelIndex(levelId.value) + 1] || null : null))

watchEffect(() => {
  document.documentElement.lang = progress.settings.lang === 'zh' ? 'zh-CN' : 'en'
})

function top() {
  window.scrollTo({ top: 0 })
}

function go(name) {
  screen.value = name
  top()
}

function openLevel(id) {
  levelId.value = id
  playKey.value++
  go('level')
}

function playAgain() {
  playKey.value++
  top()
}

function playNext() {
  if (nextLevel.value) openLevel(nextLevel.value.id)
  else go('map')
}
</script>

<template>
  <main class="app" @pointerdown.capture="unlockAudio">
    <MapView v-if="screen === 'map'" @play="openLevel" @stickers="go('stickers')" @settings="go('settings')" />
    <template v-else-if="screen === 'level' && level">
      <CageLevel
        v-if="level.kind === 'cage'"
        :key="playKey"
        :level="level"
        :has-next="Boolean(nextLevel)"
        @exit="go('map')"
        @again="playAgain"
        @next="playNext"
      />
      <ScalesLevel
        v-else
        :key="playKey"
        :level="level"
        :has-next="Boolean(nextLevel)"
        @exit="go('map')"
        @again="playAgain"
        @next="playNext"
      />
    </template>
    <StickerBook v-else-if="screen === 'stickers'" @back="go('map')" />
    <SettingsView v-else-if="screen === 'settings'" @back="go('map')" />
  </main>
</template>
