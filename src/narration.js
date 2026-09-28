// 老师讲例题时说的话：每一页一段。第 0 页读题目；第 1…n 页读第几步、做什么、为什么、怎么算；最后一页读答案和检查。
// 说的和演算纸上写的一样，只是把算式说成话（speech.js）。录音脚本也从这里取要录的话，录下来的正好是网页要读的。
import { buildPuzzle } from './core/generator.js'
import { LESSONS } from './core/lessons.js'
import { exampleWorking } from './core/styles.js'
import { leftTokens, op } from './core/tokens.js'
import { lang, t } from './i18n.js'
import { ITEMS, itemLabel } from './items.js'
import { toSpeech } from './speech.js'
import { progress } from './store.js'
import { makeWords } from './words.js'

// 练习时几句固定的话，也录下来（提示里的数每次都不一样，用设备的声音读）
export const FIXED_LINES = [
  'home.hello',
  'compose.start',
  'compose.startLook',
  'work.wrong',
  'practice.right',
  'practice.rightFirst',
  'next.stuck',
  'no.pick',
  'no.shareOne',
  'no.subNothing',
  'no.lookNoKnown',
  'no.same',
]

// 一行算式写成字：2🍎 + 🍌 = 13
export function lineText(tokens) {
  return tokens
    .map((tok) => {
      if (tok.type === 'item') return `${tok.count > 1 ? tok.count : ''}${itemLabel(tok.item)}`
      return tok.type === 'op' ? tok.text : String(tok.value)
    })
    .join(' ')
}

// 句子后面补上句号（“🍎 = ?”后面的 ? 是要求的数，不算句号）
function sentence(text) {
  const ended = /[。！？：.!:]$/.test(text) || (/\?$/.test(text) && !/[=×÷+−]\s*\?$/.test(text))
  return ended ? text : `${text}${lang() === 'zh' ? '。' : '.'}`
}

// 几个东西：水果说“2 个 🍎”，字母说“2x”
function countText(item, n) {
  if (ITEMS[item].letter) return `${n > 1 ? n : ''}${itemLabel(item)}`
  return lang() === 'zh' ? `${n} 个 ${itemLabel(item)}` : `${n} ${itemLabel(item)}`
}

// 这一步怎么算：说出算的那个数，再说算出来的那一行
function workText(step, items, words) {
  const info = step.info
  const r = step.blanks.find((b) => b.id === 'r')?.value
  // 看图算：问一句，算一道，所以……
  if (step.kind.startsWith('look')) {
    const [, sum, so] = step.lines
    const calc = sum.tokens.slice(0, sum.tokens.findIndex((tok) => tok.type === 'op' && tok.text === '='))
    return t('say.look', { ask: words.askText(step), calc: lineText(calc), r, line: lineText(so.tokens) })
  }
  const last = step.lines[step.lines.length - 1]
  const line = lineText(last.kind === 'eq' ? last.tokens : [...leftTokens(items, last.result.counts), op('='), last.result.right])
  switch (step.kind) {
    case 'share':
      return t('say.share', { total: info.total, n: info.n, r, line })
    case 'takeAway':
      return t('say.takeAway', { total: info.total, a: info.amount, r, line })
    case 'compare':
      return t('say.compare', { big: info.big, small: info.small, r, line })
    case 'combine': {
      const [top, bottom] = last.rows
      const sums = items
        .filter((item) => last.result.counts[item])
        .map((item) => {
          const a = top.counts[item] || 0
          const b = bottom.counts[item] || 0
          const c = countText(item, a + b)
          return a && b ? t('say.combineItem', { a: countText(item, a), b: countText(item, b), c }) : t('say.combineKeep', { c })
        })
      return t('say.combine', { items: sums.join(lang() === 'zh' ? '；' : '; '), ra: info.ra, rb: info.rb, r, line })
    }
    default:
      return t('say.swap', { dst: step.scaleId, line })
  }
}

// 例题每一页说的话（屏幕上的写法，读之前再用 toSpeech 变成话）
export function examplePages({ lessonId, work, words }) {
  const items = work.items
  const intro = [
    sentence(t('teach.banner')),
    t(`lesson.${lessonId}.idea`),
    t('say.problem'),
    ...work.given.map((row) => t('say.scale', { id: row.scaleId, line: lineText(row.tokens) })),
    sentence(words.goalText()),
    t('say.start'),
  ]
  const steps = work.steps.map((step, i) => {
    const title = step.titleNumber ? `${words.titleText(step)} ${step.titleNumber.value}` : words.titleText(step)
    return [t('say.step', { no: t('work.stepNo', { n: i + 1 }), title }), words.whyText(step), workText(step, items, words)]
  })
  const end = [
    sentence(t('work.answer', { answers: words.answersText(work.answer) })),
    sentence(t('teach.check')),
    ...work.checks.map((row) => t('say.scale', { id: row.id, line: words.checkLine(row) })),
    t('say.checked'),
    t('say.end'),
  ]
  return [intro, ...steps, end].map((parts) => parts.join(lang() === 'zh' ? '' : ' '))
}

export function lessonPages(lesson) {
  const { items, values, clues } = lesson.example
  const puzzle = buildPuzzle(lesson.template, values, clues, items)
  return examplePages({ lessonId: lesson.id, work: exampleWorking(lesson, puzzle), words: makeWords(puzzle.items, lesson.theme) })
}

// 要录音的话（中文）：7 课例题的每一页，再加上几句固定的话
export function recordedTexts() {
  const before = progress.settings.lang
  progress.settings.lang = 'zh'
  try {
    const texts = [...LESSONS.flatMap(lessonPages), ...FIXED_LINES.map((key) => t(key))]
    return [...new Set(texts.map((text) => toSpeech(text, 'zh')))]
  } finally {
    progress.settings.lang = before
  }
}
