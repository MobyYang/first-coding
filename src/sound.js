// 音效全部用 Web Audio 现场合成，不需要音频文件。浏览器要求用户点过屏幕后才能出声。
// 不同的操作、不同的结果，声音不一样，孩子听声音就知道发生了什么：
//   操作：点按钮 tap、选天平 select、按数字 key / back、写出来 write、擦掉一步 erase、提示 hint、翻页 page
//   方法：选这个方法、天平这样变的时候都响——÷ share、− takeAway、代入/换一换 swap、相减/比一比 compare、相加 combine
//   结果：填对 right、这一步不能这样做 nope、算错 wrong、算出一样东西 found、做完一题 solved、一次就做对 perfect、
//         星星 star、学完一课 level
import { progress } from './store.js'

let ctx = null
let noise = null

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

const notes = (freqs, start, gap, duration, options) => freqs.forEach((f, i) => tone(f, start + i * gap, duration, options))

// 一小段沙沙声：写字、擦掉、翻页
function hiss(start, duration, { volume = 0.06, filter = 'bandpass', from = 2000, to = from, q = 1 } = {}) {
  if (!noise) {
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  const source = ctx.createBufferSource()
  source.buffer = noise
  const shape = ctx.createBiquadFilter()
  shape.type = filter
  shape.Q.value = q
  shape.frequency.setValueAtTime(from, start)
  if (to !== from) shape.frequency.exponentialRampToValueAtTime(to, start + duration)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.02)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  source.connect(shape).connect(gain).connect(ctx.destination)
  source.start(start, Math.random() * 0.5)
  source.stop(start + duration + 0.05)
}

const SOUNDS = {
  // —— 操作 ——
  tap: (t) => tone(700, t, 0.07, { volume: 0.06 }),
  select: (t) => tone(520, t, 0.12, { type: 'triangle', volume: 0.1, slideTo: 780 }),
  key: (t) => tone(1050, t, 0.05, { volume: 0.05 }),
  back: (t) => tone(620, t, 0.08, { volume: 0.05, slideTo: 420 }),
  write: (t) => [0, 0.07, 0.14].forEach((d, i) => hiss(t + d, 0.06, { volume: 0.08, from: 2600 + i * 500, q: 3 })),
  erase: (t) => hiss(t, 0.32, { volume: 0.09, filter: 'lowpass', from: 4000, to: 300, q: 0.7 }),
  hint: (t) => notes([1568, 2093, 2637], t, 0.06, 0.18, { volume: 0.05 }),
  page: (t) => hiss(t, 0.16, { volume: 0.07, from: 900, to: 3200, q: 1.2 }),

  // —— 方法：选这个方法、天平这样变的时候 ——
  // ÷ 平均分：一个音分成几个往下走
  share: (t) => notes([880, 740, 587], t, 0.07, 0.12, { type: 'triangle', volume: 0.09 }),
  // − 拿走：往上一提
  takeAway: (t) => {
    tone(280, t, 0.14, { volume: 0.1, slideTo: 840 })
    tone(1260, t + 0.12, 0.06, { volume: 0.04 })
  },
  // 代入、换一换：两个音翻一下
  swap: (t) => {
    tone(659, t, 0.1, { type: 'triangle', volume: 0.09 })
    tone(988, t + 0.09, 0.14, { type: 'triangle', volume: 0.09 })
  },
  // 两式相减、比一比：一边一个音，再“嗒”一下
  compare: (t) => {
    tone(392, t, 0.12, { type: 'triangle', volume: 0.09 })
    tone(523, t + 0.13, 0.12, { type: 'triangle', volume: 0.09 })
    tone(1047, t + 0.27, 0.05, { volume: 0.04 })
  },
  // 两式相加：两个音合到一起
  combine: (t) => {
    tone(330, t, 0.22, { type: 'triangle', volume: 0.07, slideTo: 494 })
    tone(740, t, 0.22, { type: 'triangle', volume: 0.07, slideTo: 494 })
    notes([494, 622, 740], t + 0.22, 0, 0.3, { type: 'triangle', volume: 0.05 })
  },

  // —— 结果 ——
  right: (t) => {
    tone(988, t, 0.1, { volume: 0.08 })
    tone(1319, t + 0.07, 0.16, { volume: 0.07 })
  },
  nope: (t) => {
    tone(311, t, 0.14, { type: 'triangle', volume: 0.08, slideTo: 233 })
    tone(233, t + 0.13, 0.16, { type: 'triangle', volume: 0.06, slideTo: 185 })
  },
  wrong: (t) => {
    tone(260, t, 0.18, { type: 'square', volume: 0.04, slideTo: 200 })
    tone(200, t + 0.16, 0.24, { type: 'square', volume: 0.04, slideTo: 150 })
  },
  found: (t) => notes([523, 659, 784, 1047], t, 0.08, 0.22, { type: 'triangle', volume: 0.11 }),
  solved: (t) => {
    notes([523, 659, 784], t, 0, 0.5, { type: 'triangle', volume: 0.07 })
    notes([659, 784, 1047], t + 0.18, 0, 0.6, { type: 'triangle', volume: 0.07 })
  },
  perfect: (t) => {
    SOUNDS.solved(t)
    notes([1319, 1568, 2093], t + 0.55, 0.08, 0.2, { volume: 0.05 })
  },
  star: (t) => tone(880, t, 0.25, { type: 'triangle', volume: 0.1, slideTo: 1320 }),
  level: (t) => notes([392, 523, 659, 784, 1047], t, 0.11, 0.35, { type: 'triangle', volume: 0.1 }),
}

export const SOUND_NAMES = Object.keys(SOUNDS)

// 每种方法、每种步骤用哪个声音
const OPERATION = {
  share: 'share',
  takeAway: 'takeAway',
  substitute: 'swap',
  swapKnown: 'swap',
  swapBundle: 'swap',
  lookSwap: 'swap',
  subtract: 'compare',
  compare: 'compare',
  lookCompare: 'compare',
  add: 'combine',
  combine: 'combine',
}
export const soundOf = (kind) => OPERATION[kind] || 'tap'

// delay：过一会儿再响（秒），比如天平变完以后再响“算出来了”
export function play(name, delay = 0) {
  if (!progress.settings.sound || !ctx || !SOUNDS[name]) return
  try {
    SOUNDS[name](ctx.currentTime + 0.01 + delay)
  } catch {
    // 声音出不来不影响学习
  }
}
