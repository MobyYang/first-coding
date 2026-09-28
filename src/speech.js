// 把屏幕上的字变成老师读的话：🍎 读“苹果”，2🍎 读“2个苹果”，÷ 读“除以”，🍎 = ? 读“苹果等于几”。
// 录音（scripts/make-voice.mjs）和设备朗读都先经过这里，所以同一句话录下来的和要读的一模一样。
import { ITEMS } from './items.js'

const FRUITS = Object.values(ITEMS).filter((info) => info.emoji)
const SIGNS = {
  zh: { '+': '加', '−': '减', '×': '乘', '÷': '除以', '=': '等于' },
  en: { '+': ' plus ', '−': ' minus ', '×': ' times ', '÷': ' divided by ', '=': ' equals ' },
}

function plural(word) {
  if (/s$/.test(word)) return word
  if (/(ch|sh|x)$/.test(word)) return `${word}es`
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`
  return `${word}s`
}

export function toSpeech(text, lang = 'zh') {
  const zh = lang === 'zh'
  let s = String(text)
  for (const info of FRUITS) {
    s = s.replace(new RegExp(`(\\d+)\\s*${info.emoji}`, 'gu'), (_, n) =>
      zh ? `${n}个${info.zh}` : ` ${n} ${Number(n) > 1 ? plural(info.en) : info.en}`,
    )
    s = s.split(info.emoji).join(zh ? info.zh : ` ${info.en}`)
  }
  // 要求的数：= ?、× ? 读成“几”
  s = s.replace(/([=×÷+−])\s*\?/g, zh ? '$1几' : '$1 what')
  if (!zh) s = s.replace(/¥(\d+)/g, '$1 yuan')
  s = s.replace(/[+−×÷=]/g, (sign) => SIGNS[zh ? 'zh' : 'en'][sign])
  // 别的图标不读
  s = s.replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}→←↺↶✓]/gu, '')
  s = s.replace(/[　·]/g, zh ? '，' : ', ')
  if (zh) return s.replace(/\s+/g, '').replace(/^[，、]+/, '')
  return s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim()
}

// 一句话 + 用的哪个声音 → 录音的文件名。录音脚本和网页用同一个算法，网页才找得到录好的那一句。
export function voiceKey(profile, text) {
  const str = `${profile}|${text}`
  let h1 = 0xdeadbeef
  let h2 = 0x41c6ce57
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i)
    h1 = Math.imul(h1 ^ ch, 2654435761)
    h2 = Math.imul(h2 ^ ch, 1597334677)
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909)
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909)
  return (h2 >>> 0).toString(16).padStart(8, '0') + (h1 >>> 0).toString(16).padStart(8, '0')
}
