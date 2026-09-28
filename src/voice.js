// 老师讲解的声音。有录好的豆包语音就放录音（public/voice/，用 npm run voice 生成，见 scripts/make-voice.mjs）；
// 没录好的话（提示里的数每次都不一样，或者还没生成录音）用这台设备自带的朗读（speechSynthesis）。
// 浏览器要求点过屏幕才能出声，所以第一次点屏幕时先“解锁”。出不了声也不影响学习。
import manifest from './voice-manifest.json'
import { lang } from './i18n.js'
import { toSpeech, voiceKey } from './speech.js'
import { progress } from './store.js'

const recorded = new Set(manifest.keys)
const SILENT =
  'data:audio/wav;base64,UklGRnQAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YVAAAACAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgA=='
let player = null
let unlocked = false
let turn = 0 // 每说一段新的就加 1：旧的那段出错时，不再接着用设备的声音读

const synth = () => (typeof window !== 'undefined' && window.speechSynthesis) || null

function getPlayer() {
  if (!player && typeof Audio !== 'undefined') player = new Audio()
  return player
}

export function unlockVoice() {
  if (unlocked) return
  unlocked = true
  try {
    if (recorded.size) {
      const el = getPlayer()
      el.src = SILENT
      el.play()?.catch(() => {})
    }
    const s = synth()
    if (s) {
      s.getVoices()
      const quiet = new SpeechSynthesisUtterance(' ')
      quiet.volume = 0
      s.speak(quiet)
    }
  } catch {
    // 出不了声也没关系
  }
}

export function stopVoice() {
  turn++
  try {
    player?.pause()
    synth()?.cancel()
  } catch {
    // 同上
  }
}

// 挑一个这种语言的声音：普通话优先 zh-CN，没有就 zh-TW；不用粤语。这台设备没有这种语言的声音就不读（免得读成乱码）
function pickVoice(code) {
  const voices = synth().getVoices()
  if (!voices.length) return null // 声音列表还没准备好：交给浏览器按语言挑
  const norm = (v) => v.lang.replace('_', '-').toLowerCase()
  const order = code === 'zh-CN' ? [/^(zh-cn|zh-hans|cmn)/, /^zh-tw/, /^zh$/] : [/^en-(us|gb)/, /^en/]
  for (const pattern of order) {
    const same = voices.filter((v) => pattern.test(norm(v)))
    if (same.length) return same.find((v) => /natural|premium|enhanced/i.test(v.name)) || same[0]
  }
  return false
}

function speakWithDevice(words) {
  const s = synth()
  if (!s || typeof SpeechSynthesisUtterance === 'undefined') return
  const code = lang() === 'zh' ? 'zh-CN' : 'en-US'
  const voice = pickVoice(code)
  if (voice === false) return
  // 一句一句排队读：有的浏览器一段话太长会读到一半停下
  const parts = words.match(lang() === 'zh' ? /[^。！？；]+[。！？；]*/g : /[^.!?;]+[.!?;]*/g) || []
  for (const part of parts) {
    if (!part.trim()) continue
    const u = new SpeechSynthesisUtterance(part.trim())
    u.lang = code
    if (voice) u.voice = voice
    u.rate = 0.95
    s.speak(u)
  }
}

function playRecording(key, words, mine) {
  const el = getPlayer()
  let fellBack = false
  const fallBack = () => {
    if (fellBack || mine !== turn) return
    fellBack = true
    speakWithDevice(words)
  }
  el.onerror = fallBack
  el.src = `voice/${key}.mp3`
  el.play()?.catch((err) => {
    if (err?.name !== 'AbortError') fallBack()
  })
}

// 老师讲解开 / 关：关掉时马上停下
export function toggleVoice() {
  progress.settings.voice = !progress.settings.voice
  if (!progress.settings.voice) stopVoice()
  return progress.settings.voice
}

// 读一段话（屏幕上的写法，比如“2🍎 + 🍌 = 13”）：先停下正在读的
export function say(text) {
  stopVoice()
  if (!text || !progress.settings.voice) return
  const mine = turn
  try {
    const words = toSpeech(text, lang())
    const key = lang() === 'zh' && manifest.voice ? voiceKey(manifest.voice, words) : null
    if (key && recorded.has(key) && getPlayer()) playRecording(key, words, mine)
    else speakWithDevice(words)
  } catch {
    // 出不了声也没关系
  }
}

// 离开这个页面（切到别的应用）时别再读了
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopVoice()
  })
}
