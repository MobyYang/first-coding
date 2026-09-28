// 学习进度：只存在这台设备的浏览器里（localStorage），读写失败也不影响游戏
import { reactive, watch } from 'vue'
import { LEVELS, levelIndex } from './core/levels.js'

const KEY = 'equation-detective:v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

function defaultLang() {
  try {
    return navigator.language?.toLowerCase().startsWith('zh') ? 'zh' : 'en'
  } catch {
    return 'zh'
  }
}

const saved = load()

export const progress = reactive({
  // 每关最好的星星数，例如 { '1-1': { stars: 3 } }
  levels: saved.levels || {},
  settings: { lang: defaultLang(), sound: true, unlockAll: false, ...(saved.settings || {}) },
})

watch(
  progress,
  () => {
    try {
      localStorage.setItem(KEY, JSON.stringify(progress))
    } catch {
      // 隐私模式等情况下存不了，就只在这次打开时记住
    }
  },
  { deep: true },
)

export function starsOf(id) {
  return progress.levels[id]?.stars || 0
}

export function isUnlocked(id) {
  const index = levelIndex(id)
  return progress.settings.unlockAll || index === 0 || starsOf(LEVELS[index - 1].id) > 0
}

export function totalStars() {
  return LEVELS.reduce((sum, level) => sum + starsOf(level.id), 0)
}

// 记录成绩，返回这次是不是第一次拿到贴纸、是不是第一次拿到金边
export function recordLevel(id, stars) {
  const before = starsOf(id)
  if (stars > before) progress.levels[id] = { stars }
  return { firstSticker: before === 0, firstGold: stars === 3 && before < 3 }
}

export function nextLevelToPlay() {
  return LEVELS.find((level) => isUnlocked(level.id) && starsOf(level.id) === 0) || null
}

export function resetProgress() {
  progress.levels = {}
}
