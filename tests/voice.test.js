import { describe, expect, it } from 'vitest'
import { LESSONS } from '../src/core/lessons.js'
import { buildPuzzle } from '../src/core/generator.js'
import { buildWorking } from '../src/core/working.js'
import { FIXED_LINES, lessonPages, lineText, recordedTexts } from '../src/narration.js'
import { toSpeech, voiceKey } from '../src/speech.js'
import { hasKey } from '../src/i18n.js'
import { parseStream } from '../scripts/make-voice.mjs'
import { progress } from '../src/store.js'

describe('reading the working aloud', () => {
  it('says equations the way a teacher would', () => {
    expect(toSpeech('2🍎 + 🍌 = 13')).toBe('2个苹果加香蕉等于13')
    expect(toSpeech('C 的两边同时 ÷ 3')).toBe('C的两边同时除以3')
    expect(toSpeech('11 − 3 = 8，所以 2🍎 = 8。')).toBe('11减3等于8，所以2个苹果等于8。')
    expect(toSpeech('求：🍎 = ?，🍌 = ?')).toBe('求：苹果等于几，香蕉等于几')
    expect(toSpeech('27 ÷ 3 = ?　想一想：3 × ? = 27')).toBe('27除以3等于几，想一想：3乘几等于27')
    expect(toSpeech('📖 这是例题 ✓')).toBe('这是例题')
    expect(toSpeech('2x + y = 14')).toBe('2x加y等于14')
  })

  it('reads English too', () => {
    expect(toSpeech('3🍎 + 2🍌 = 22', 'en')).toBe('3 apples plus 2 bananas equals 22')
    expect(toSpeech('Find: 🍎 = ?, 🧃 = ?', 'en')).toBe('Find: apple equals what, juice box equals what')
    expect(toSpeech('2 🧃 cost ¥6', 'en')).toBe('2 juice boxes cost 6 yuan')
  })

  it('names a recording by the voice and the words', () => {
    const key = voiceKey('zh_female_xiaohe_uranus_bigtts', '答对了！')
    expect(key).toMatch(/^[0-9a-f]{16}$/)
    expect(voiceKey('zh_female_xiaohe_uranus_bigtts', '答对了！')).toBe(key)
    expect(voiceKey('zh_female_vv_uranus_bigtts', '答对了！')).not.toBe(key)
    expect(voiceKey('zh_female_xiaohe_uranus_bigtts', '答对了')).not.toBe(key)
  })
})

describe('the teacher explaining each example', () => {
  it('has one page for the problem, one per step and one for the answer', () => {
    for (const lesson of LESSONS) {
      const { items, values, clues } = lesson.example
      const work = buildWorking(buildPuzzle(lesson.template, values, clues, items), lesson.tools)
      const pages = lessonPages(lesson)
      expect(pages).toHaveLength(work.steps.length + 2)
      expect(pages[0]).toContain(lineText(work.given[0].tokens))
      work.steps.forEach((step, i) => expect(pages[i + 1]).toContain(`第 ${i + 1} 步`))
    }
  })

  it('says every number that the step works out', () => {
    const lesson = LESSONS.find((l) => l.id === '5')
    const { items, values, clues } = lesson.example
    const work = buildWorking(buildPuzzle(lesson.template, values, clues, items), lesson.tools)
    lessonPages(lesson)
      .slice(1, -1)
      .forEach((page, i) => {
        for (const blank of work.steps[i].blanks) expect(page).toContain(String(blank.value))
      })
  })

  it('records plain Chinese words: no emoji, no maths signs, no gaps', () => {
    const texts = recordedTexts()
    expect(texts.length).toBe(new Set(texts).size)
    expect(texts.length).toBeGreaterThanOrEqual(LESSONS.length * 3 + FIXED_LINES.length)
    for (const text of texts) {
      expect(text).not.toMatch(/[\p{Extended_Pictographic}+−×÷=?{}]/u)
      expect(text.length).toBeLessThan(300)
    }
    for (const key of FIXED_LINES) expect(hasKey(key)).toBe(true)
  })

  it('records Chinese even when the page is in English', () => {
    const zh = recordedTexts()
    progress.settings.lang = 'en'
    try {
      expect(recordedTexts()).toEqual(zh)
      expect(progress.settings.lang).toBe('en')
      expect(lessonPages(LESSONS[0])[1]).toContain('Step 1')
    } finally {
      progress.settings.lang = 'zh'
    }
  })
})

describe('the recording script', () => {
  const line = (obj) => `${JSON.stringify(obj)}\n`
  const part = (text) => line({ code: 0, message: '', data: Buffer.from(text).toString('base64') })

  it('joins the pieces of sound it receives', () => {
    const reply = part('ID3abc') + part('def') + line({ code: 20000000, message: 'ok', data: null })
    expect(parseStream(reply).toString()).toBe('ID3abcdef')
    expect(parseStream(`data: ${part('xyz')}`).toString()).toBe('xyz')
  })

  it('explains what went wrong', () => {
    const mismatch = line({ code: 45000000, message: 'resource ID is mismatched with speaker related resource' })
    expect(() => parseStream(mismatch)).toThrow(/seed-tts-2\.0/)
    expect(() => parseStream(line({ code: 20000000, message: 'ok' }))).toThrow(/没有收到声音/)
  })
})
