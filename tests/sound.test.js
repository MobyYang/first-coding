import { describe, expect, it } from 'vitest'
import { LESSONS } from '../src/core/lessons.js'
import { buildPuzzle } from '../src/core/generator.js'
import { exampleWorking } from '../src/core/styles.js'
import { SOUND_NAMES, soundOf } from '../src/sound.js'

describe('sound effects', () => {
  it('gives every method the child can choose its own sound', () => {
    const methods = [...new Set(LESSONS.flatMap((lesson) => lesson.methods))]
    for (const method of methods) {
      expect(SOUND_NAMES).toContain(soundOf(method))
      expect(soundOf(method)).not.toBe('tap')
    }
    // ÷、−、代入、相减、相加：五种声音都不一样
    const five = ['share', 'takeAway', 'substitute', 'subtract', 'add'].map(soundOf)
    expect(new Set(five).size).toBe(5)
    // 第 4 课的比一比、换一换和课本里的相减、代入是同一个声音
    expect(soundOf('lookCompare')).toBe(soundOf('subtract'))
    expect(soundOf('lookSwap')).toBe(soundOf('substitute'))
  })

  it('plays the method’s sound when a scale changes in the worked examples', () => {
    for (const lesson of LESSONS) {
      const { items, values, clues } = lesson.example
      for (const step of exampleWorking(lesson, buildPuzzle(lesson.template, values, clues, items)).steps) {
        expect(SOUND_NAMES).toContain(soundOf(step.kind))
        expect(soundOf(step.kind)).not.toBe('tap')
      }
    }
  })

  it('has different sounds for each kind of result', () => {
    const results = ['right', 'nope', 'wrong', 'found', 'solved', 'perfect']
    for (const name of [...results, 'write', 'erase', 'hint', 'page', 'key', 'back']) expect(SOUND_NAMES).toContain(name)
  })
})
