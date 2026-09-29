// 音效全部用 Web Audio 现场合成，不需要音频文件。浏览器要求用户点过屏幕后才能出声。
import { progress } from './store.js'

let ctx = null

export function unlockAudio() {
  try {
    if (!ctx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext
      if (!AudioContext) return
      ctx = new AudioContext()
    }
    if (ctx.state === 'suspended') ctx.resume()
  } catch {
    ctx = null
  }
}

function tone(freq, start, duration, { type = 'sine', volume = 0.12, slideTo } = {}) {
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.setValueAtTime(freq, start)
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, start + duration)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(gain).connect(ctx.destination)
  osc.start(start)
  osc.stop(start + duration + 0.05)
}

const SOUNDS = {
  tap: (t) => tone(700, t, 0.07, { volume: 0.06 }),
  select: (t) => tone(520, t, 0.12, { type: 'triangle', volume: 0.1, slideTo: 780 }),
  move: (t) => {
    tone(330, t, 0.16, { type: 'triangle', volume: 0.1, slideTo: 520 })
    tone(660, t + 0.12, 0.12, { volume: 0.06 })
  },
  found: (t) => [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.08, 0.22, { type: 'triangle', volume: 0.11 })),
  wrong: (t) => {
    tone(260, t, 0.18, { type: 'square', volume: 0.04, slideTo: 200 })
    tone(200, t + 0.16, 0.24, { type: 'square', volume: 0.04, slideTo: 150 })
  },
  solved: (t) => {
    ;[523, 659, 784].forEach((f) => tone(f, t, 0.5, { type: 'triangle', volume: 0.07 }))
    ;[659, 784, 1047].forEach((f) => tone(f, t + 0.18, 0.6, { type: 'triangle', volume: 0.07 }))
  },
  star: (t) => tone(880, t, 0.25, { type: 'triangle', volume: 0.1, slideTo: 1320 }),
  level: (t) => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.11, 0.35, { type: 'triangle', volume: 0.1 })),
}

export function play(name) {
  if (!progress.settings.sound || !ctx || !SOUNDS[name]) return
  try {
    SOUNDS[name](ctx.currentTime + 0.01)
  } catch {
    // 声音出不来不影响游戏
  }
}
