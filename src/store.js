// 学习记录：只存在这台设备的浏览器里（localStorage），读写失败也不影响使用
import { reactive, watch } from 'vue'
import { LESSONS } from './core/lessons.js'

const KEY = 'balance-equations:v1'

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {}
  } catch {
    return {}
  }
}

const saved = load()

// 默认中文；只有自己选了英文，才显示英文
function initialLang(settings = {}) {
  return settings.langChosen && settings.lang === 'en' ? 'en' : 'zh'
}

export const progress = reactive({
  // 每课最好成绩，例如 { '1': { stars: 3, best: 5 } }
  lessons: saved.lessons || {},
  // 题库里每课做了几道题、几道一次做对，例如 { '4': { done: 12, right: 9 } }
  bank: saved.bank || {},
  // sound：音效；voice：老师讲解的声音
  settings: { sound: true, voice: true, ...(saved.settings || {}), lang: initialLang(saved.settings) },
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

export function setLang(lang) {
  progress.settings.lang = lang
  progress.settings.langChosen = true
}

export function starsOf(id) {
  return progress.lessons[id]?.stars || 0
}

export function recordLesson(id, stars, best) {
  const before = progress.lessons[id] || { stars: 0, best: 0 }
  progress.lessons[id] = { stars: Math.max(before.stars, stars), best: Math.max(before.best, best) }
}

export function bankOf(id) {
  return progress.bank[id] || { done: 0, right: 0 }
}

export function recordBank(id, right) {
  const before = bankOf(id)
  progress.bank[id] = { done: before.done + 1, right: before.right + (right ? 1 : 0) }
}

// 下一课：第一节还没学过的课
export function nextLesson() {
  return LESSONS.find((lesson) => starsOf(lesson.id) === 0) || null
}

export function resetProgress() {
  progress.lessons = {}
  progress.bank = {}
}
