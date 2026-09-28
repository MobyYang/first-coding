import { describe, expect, it } from 'vitest'
import { checkWithAnswer, explainPuzzle } from '../src/core/explain.js'
import { MAX_RIGHT, buildPuzzle, generateLevel } from '../src/core/generator.js'
import { LESSONS } from '../src/core/lessons.js'
import {
  applyCombine,
  applyMove,
  applyRemove,
  applyShare,
  applySwap,
  applyTakeAway,
  canRemove,
  discoveredValues,
  isSolved,
  makeBoard,
  makeScale,
  shareFactor,
  swapTimes,
  weighAll,
} from '../src/core/scale.js'
import { planSolution } from '../src/core/solver.js'
import { lineValues } from '../src/core/tokens.js'
import { buildWorking } from '../src/core/working.js'
import { foundList, nextStepHint, planStep, practiceSolved, startPractice } from '../src/core/practice.js'

// 行列式不为 0 ⇔ 方程组只有一组解
function determinant(matrix) {
  const m = matrix.map((row) => [...row])
  let det = 1
  for (let col = 0; col < m.length; col++) {
    let pivot = col
    while (pivot < m.length && Math.abs(m[pivot][col]) < 1e-9) pivot++
    if (pivot === m.length) return 0
    if (pivot !== col) {
      ;[m[pivot], m[col]] = [m[col], m[pivot]]
      det = -det
    }
    det *= m[col][col]
    for (let row = col + 1; row < m.length; row++) {
      const factor = m[row][col] / m[col][col]
      for (let k = col; k < m.length; k++) m[row][k] -= factor * m[col][k]
    }
  }
  return det
}

describe('scale moves', () => {
  it('shares both sides into equal parts', () => {
    const board = makeBoard(['apple'], [makeScale('A', { apple: 3 }, 12)])
    const next = applyShare(board, 'A')
    expect(next.scales[0]).toMatchObject({ counts: { apple: 1 }, right: 4 })
    expect(discoveredValues(next)).toEqual({ apple: 4 })
    expect(isSolved(next)).toBe(true)
  })

  it('shares mixed pans when every count has a common factor', () => {
    const scale = makeScale('A', { apple: 2, banana: 4 }, 26)
    expect(shareFactor(scale)).toBe(2)
    expect(shareFactor(makeScale('B', { apple: 2, banana: 3 }, 23))).toBe(0)
    expect(shareFactor(makeScale('C', { apple: 2 }, 13, [3]))).toBe(0)
  })

  it('takes the same weight off both sides', () => {
    const board = makeBoard(['apple'], [makeScale('A', { apple: 2 }, 11, [3])])
    const next = applyTakeAway(board, 'A', 0)
    expect(next.scales[0]).toMatchObject({ counts: { apple: 2 }, blocks: [], right: 8 })
    expect(applyTakeAway(next, 'A', 0)).toBeNull()
  })

  it('swaps whole sets of items for their weight', () => {
    // 🍎 + 🍌 = 9 装进 3🍎 + 2🍌 = 22 两次，剩下 🍎 + 9 + 9 = 22
    const board = makeBoard(
      ['apple', 'banana'],
      [makeScale('A', { apple: 1, banana: 1 }, 9), makeScale('B', { apple: 3, banana: 2 }, 22)],
    )
    expect(swapTimes(board.scales[0], board.scales[1])).toBe(2)
    expect(swapTimes(board.scales[1], board.scales[0])).toBe(0)
    const next = applySwap(board, 'A', 'B')
    expect(next.scales[1]).toMatchObject({ counts: { apple: 1 }, blocks: [9, 9], right: 22 })
  })

  it('refuses a swap that would leave the target pan empty', () => {
    const a = makeScale('A', { apple: 1, banana: 1 }, 9)
    const b = makeScale('B', { apple: 2, banana: 2 }, 18)
    expect(swapTimes(a, b)).toBe(0)
  })

  it('combines two scales into a new one that can be put away again', () => {
    const board = makeBoard(
      ['apple', 'banana'],
      [makeScale('A', { apple: 2, banana: 1 }, 13), makeScale('B', { apple: 1, banana: 2 }, 14)],
    )
    const next = applyCombine(board, 'A', 'B')
    expect(next.scales).toHaveLength(3)
    expect(next.scales[2]).toMatchObject({ id: 'C', counts: { apple: 3, banana: 3 }, right: 27, combined: true })
    expect(applyRemove(next, 'A')).toBeNull()
    expect(applyRemove(next, 'C').scales).toHaveLength(2)
  })

  it('keeps a combined scale when the other clues depend on it', () => {
    // A 和 B 其实是同一条线索，只有 C 还知道 x 有多重，收起 C 就破不了案了
    const combined = { ...makeScale('C', { x: 1 }, 3), combined: true }
    const board = makeBoard(
      ['x', 'y'],
      [makeScale('A', { x: 1, y: 1 }, 7), makeScale('B', { x: 1, y: 1 }, 13, [6]), combined],
    )
    expect(canRemove(board, 'C')).toBe(false)
    expect(applyRemove(board, 'C')).toBeNull()
  })

  it('weighs guesses on every scale', () => {
    const board = makeBoard(
      ['apple', 'banana'],
      [makeScale('A', { apple: 2 }, 10), makeScale('B', { apple: 1, banana: 1 }, 8)],
    )
    expect(weighAll(board, { apple: 5, banana: 3 }).every((r) => r.balanced)).toBe(true)
    const wrong = weighAll(board, { apple: 6, banana: 3 })
    expect(wrong[0]).toMatchObject({ left: 12, right: 10, balanced: false })
  })
})

describe('solver', () => {
  it('solves a puzzle that needs combining first', () => {
    const board = makeBoard(
      ['apple', 'banana'],
      [makeScale('A', { apple: 2, banana: 1 }, 13), makeScale('B', { apple: 1, banana: 2 }, 14)],
    )
    expect(planSolution(board, ['share', 'takeAway', 'swap'])).toBeNull()
    const plan = planSolution(board, ['share', 'takeAway', 'swap', 'combine'])
    expect(plan[0].type).toBe('combine')
    let current = board
    for (const move of plan) current = applyMove(current, move)
    expect(discoveredValues(current)).toEqual({ apple: 4, banana: 5 })
  })
})

describe('puzzle generator', () => {
  for (const level of LESSONS) {
    it(`lesson ${level.id}: one whole-number answer, solvable with the lesson's methods`, () => {
      for (let seed = 1; seed <= 150; seed++) {
        const puzzles = generateLevel(level, seed)
        expect(puzzles).toHaveLength(level.count)
        for (const puzzle of puzzles) {
          const { board, answer, items } = puzzle
          const values = Object.values(answer)
          expect(values.every((v) => Number.isInteger(v) && v > 0)).toBe(true)
          expect(new Set(values).size).toBe(values.length)
          expect(board.scales).toHaveLength(items.length)
          for (const scale of board.scales) {
            expect(Number.isInteger(scale.right)).toBe(true)
            expect(scale.right).toBeLessThanOrEqual(MAX_RIGHT)
          }
          const matrix = board.scales.map((s) => items.map((item) => s.counts[item] || 0))
          expect(Math.abs(determinant(matrix))).toBeGreaterThan(1e-9)
          expect(weighAll(board, answer).every((r) => r.balanced)).toBe(true)

          const plan = planSolution(board, level.tools)
          expect(plan).not.toBeNull()
          let current = board
          for (const move of plan) current = applyMove(current, move)
          expect(discoveredValues(current)).toEqual(answer)
          for (const tool of level.needs || []) expect(plan.some((m) => m.type === tool)).toBe(true)
        }
      }
    })
  }
})

// 讲解要一步一步把答案算出来，每一步的算式都要对
function expectExplained(puzzle, lesson) {
  const steps = explainPuzzle(puzzle, lesson.tools)
  expect(steps).not.toBeNull()
  expect(steps.length).toBeGreaterThan(0)
  expect(steps.length).toBeLessThanOrEqual(8)
  for (const step of steps) {
    if (step.kind === 'share') expect(step.result * step.n).toBe(step.total)
    if (step.kind === 'takeAway') expect(step.total - step.amount).toBe(step.result)
    if (step.kind === 'compare') expect(step.big - step.small).toBe(step.result)
    if (step.kind === 'combine') expect(step.ra + step.rb).toBe(step.result)
  }
  const last = steps[steps.length - 1].board
  expect(isSolved(last)).toBe(true)
  expect(discoveredValues(last)).toEqual(puzzle.answer)
  expect(checkWithAnswer(puzzle.board, puzzle.answer).every((row) => row.ok)).toBe(true)
  const kinds = steps.map((step) => step.kind)
  if (lesson.needs?.includes('swap')) expect(kinds.some((k) => ['swapKnown', 'swapBundle', 'compare'].includes(k))).toBe(true)
  if (lesson.needs?.includes('combine')) expect(kinds).toContain('combine')
  if (lesson.needs?.includes('takeAway')) expect(kinds.some((k) => k === 'takeAway' || k === 'compare')).toBe(true)
  return steps
}

describe('explanations', () => {
  for (const lesson of LESSONS) {
    it(`lesson ${lesson.id}: the worked example and every practice problem are explained step by step`, () => {
      const { items, values, clues } = lesson.example
      const example = buildPuzzle(lesson.template, values, clues, items)
      expectExplained(example, lesson)
      for (let seed = 1; seed <= 100; seed++) {
        for (const puzzle of generateLevel(lesson, seed)) expectExplained(puzzle, lesson)
      }
    })
  }

  it('explains “compare the scales” as one step', () => {
    const lesson = LESSONS.find((l) => l.id === '4')
    const { items, values, clues } = lesson.example
    const steps = explainPuzzle(buildPuzzle(lesson.template, values, clues, items), lesson.tools)
    expect(steps[0]).toMatchObject({ kind: 'compare', src: 'A', dst: 'B', extra: { apple: 1 }, big: 14, small: 10, result: 4 })
  })

  it('puts several weights taken off the same scale into one step', () => {
    const board = makeBoard(['apple', 'banana'], [makeScale('A', { apple: 1, banana: 1 }, 9), makeScale('B', { apple: 3, banana: 2 }, 22)])
    const steps = explainPuzzle({ board, answer: { apple: 4, banana: 5 } }, ['share', 'takeAway', 'swap'])
    expect(steps[0]).toMatchObject({ kind: 'swapBundle', times: 2 })
    expect(steps[1]).toMatchObject({ kind: 'takeAway', taken: [9, 9], amount: 18, total: 22, result: 4 })
  })
})

// 演算：每一行算式代入答案都成立；竖式里左边加（减）左边、右边加（减）右边；
// 每一步都有孩子要填的空；一步一步做下来，算出全部答案
function expectWorking(puzzle, lesson) {
  const work = buildWorking(puzzle, lesson.tools)
  expect(work).not.toBeNull()
  const weigh = (counts) => Object.entries(counts).reduce((sum, [item, n]) => sum + n * puzzle.answer[item], 0)
  const holds = (tokens) => {
    const values = lineValues(tokens, puzzle.answer)
    expect(values.length).toBeGreaterThan(1)
    for (const v of values) expect(v).toBe(values[0])
  }
  work.given.forEach((row) => holds(row.tokens))
  const found = {}
  for (const step of work.steps) {
    const ids = new Set()
    if (step.titleNumber?.blank) ids.add(step.titleNumber.blank)
    for (const line of step.lines) {
      if (line.kind === 'eq') {
        holds(line.tokens)
        for (const tok of line.tokens) {
          if (tok.type === 'ref') expect(ids.has(tok.of)).toBe(true)
          if (tok.blank) ids.add(tok.blank)
        }
        continue
      }
      const sign = line.op === '+' ? 1 : -1
      const [top, bottom] = line.rows
      for (const row of line.rows) expect(weigh(row.counts)).toBe(row.right)
      const expected = {}
      for (const item of new Set([...Object.keys(top.counts), ...Object.keys(bottom.counts)])) {
        const n = (top.counts[item] || 0) + sign * (bottom.counts[item] || 0)
        expect(n).toBeGreaterThanOrEqual(0)
        if (n) expected[item] = n
      }
      expect(line.result.counts).toEqual(expected)
      expect(line.result.right.value).toBe(top.right + sign * bottom.right)
      expect(weigh(line.result.counts)).toBe(line.result.right.value)
      ids.add(line.result.right.blank)
      for (const id of Object.values(line.result.countBlanks)) ids.add(id)
    }
    expect(step.blanks.length).toBeGreaterThan(0)
    expect(step.blanks.map((b) => b.id).sort()).toEqual([...ids].sort())
    for (const blank of step.blanks) {
      expect(Number.isInteger(blank.value)).toBe(true)
      expect(blank.value).toBeGreaterThan(0)
      expect(blank.value).toBeLessThan(100) // 数字键盘最多填两位数
    }
    expect(step.visual.after).toBeTruthy()
    if (step.found) found[step.found.item] = step.found.value
  }
  expect(found).toEqual(puzzle.answer)
  return work
}

const tokensText = (tokens) =>
  tokens
    .map((tok) => {
      if (tok.type === 'item') return tok.count > 1 ? `${tok.count}${tok.item}` : tok.item
      return tok.type === 'op' ? tok.text : String(tok.value)
    })
    .join(' ')
const countsText = (counts) =>
  Object.entries(counts)
    .map(([item, n]) => (n > 1 ? `${n}${item}` : item))
    .join(' + ')
const linesText = (step) =>
  step.lines.map((line) =>
    line.kind === 'eq'
      ? `${line.tag}: ${tokensText(line.tokens)}`
      : `${line.rows[0].tag} ${line.op} ${line.rows[1].tag}: ${countsText(line.result.counts)} = ${line.result.right.value}`,
  )

function exampleOf(id) {
  const lesson = LESSONS.find((l) => l.id === id)
  const { items, values, clues } = lesson.example
  return { lesson, puzzle: buildPuzzle(lesson.template, values, clues, items) }
}

describe('working (演算)', () => {
  for (const lesson of LESSONS) {
    it(`lesson ${lesson.id}: every line of the working is true and the steps reach every answer`, () => {
      const { puzzle } = exampleOf(lesson.id)
      expectWorking(puzzle, lesson)
      for (let seed = 1; seed <= 100; seed++) {
        for (const problem of generateLevel(lesson, seed)) expectWorking(problem, lesson)
      }
    })
  }

  it('writes both sides of every step, and substitutes in place', () => {
    const { lesson, puzzle } = exampleOf('3')
    const work = buildWorking(puzzle, lesson.tools)
    expect(work.given.map((row) => tokensText(row.tokens))).toEqual(['2apple = 10', 'apple + banana = 8'])
    expect(work.steps.map(linesText)).toEqual([
      ['A: 2apple ÷ 2 = 10 ÷ 2', 'A: apple = 5'],
      ['B: apple + banana = 8', 'B: 5 + banana = 8'],
      ['B: 5 + banana − 5 = 8 − 5', 'B: banana = 3'],
    ])
    expect(work.steps.map((step) => step.blanks.map((b) => `${b.id}=${b.value}`))).toEqual([['n=2', 'r=5'], ['v=5'], ['a=5', 'r=3']])
  })

  it('adds and subtracts two scales in columns', () => {
    const { lesson, puzzle } = exampleOf('5')
    const work = buildWorking(puzzle, lesson.tools)
    expect(work.steps.map(linesText)).toEqual([
      ['A + B: 3apple + 3banana = 27'],
      ['C: ( 3apple + 3banana ) ÷ 3 = 27 ÷ 3', 'C: apple + banana = 9'],
      ['A − C: apple = 4'],
      ['C: apple + banana = 9', 'C: 4 + banana = 9'],
      ['C: 4 + banana − 4 = 9 − 4', 'C: banana = 5'],
    ])
    expect(work.steps[0].blanks.map((b) => b.id)).toEqual(['c-apple', 'c-banana', 'r'])
    expect(work.steps[2].lines[0].rows.map((row) => countsText(row.counts))).toEqual(['2apple + banana', 'apple + banana'])
  })

  it('writes 2 × 4 when two of the same thing are replaced', () => {
    const board = makeBoard(['apple', 'banana'], [makeScale('A', { apple: 3 }, 12), makeScale('B', { apple: 2, banana: 1 }, 13)])
    const work = buildWorking({ items: ['apple', 'banana'], board, answer: { apple: 4, banana: 5 } }, ['share', 'takeAway', 'swap'])
    expect(work.steps.map(linesText)).toEqual([
      ['A: 3apple ÷ 3 = 12 ÷ 3', 'A: apple = 4'],
      ['B: 2apple + banana = 13', 'B: 2 × 4 + banana = 13'],
      ['B: 2 × 4 + banana − 8 = 13 − 8', 'B: banana = 5'],
    ])
  })

  it('splits a scale into whole sets before swapping them', () => {
    const board = makeBoard(['apple', 'banana'], [makeScale('A', { apple: 1, banana: 1 }, 9), makeScale('B', { apple: 3, banana: 2 }, 22)])
    const work = buildWorking({ items: ['apple', 'banana'], board, answer: { apple: 4, banana: 5 } }, ['share', 'takeAway', 'swap'])
    expect(work.steps.map(linesText).slice(0, 2)).toEqual([
      ['B: 3apple + 2banana = 22', 'B: apple + ( apple + banana ) + ( apple + banana ) = 22', 'B: apple + 9 + 9 = 22'],
      ['B: apple + 9 + 9 − 18 = 22 − 18', 'B: apple = 4'],
    ])
  })
})

// 孩子自己列的一步：每一行代入答案都成立，竖式加减都对，结果里要算的数都留了空
function expectStepLines(step, answer) {
  const weigh = (counts) => Object.entries(counts).reduce((sum, [item, n]) => sum + n * answer[item], 0)
  const ids = new Set()
  for (const line of step.lines) {
    if (line.kind === 'eq') {
      const values = lineValues(line.tokens, answer)
      for (const v of values) expect(v).toBe(values[0])
      for (const tok of line.tokens) if (tok.blank) ids.add(tok.blank)
      continue
    }
    const sign = line.op === '+' ? 1 : -1
    const [top, bottom] = line.rows
    expect(line.result.right.value).toBe(top.right + sign * bottom.right)
    expect(weigh(line.result.counts)).toBe(line.result.right.value)
    ids.add(line.result.right.blank)
    for (const id of Object.values(line.result.countBlanks)) ids.add(id)
  }
  expect(step.blanks.map((b) => b.id).sort()).toEqual([...ids].sort())
  for (const blank of step.blanks) {
    expect(Number.isInteger(blank.value)).toBe(true)
    expect(blank.value).toBeGreaterThan(0)
    expect(blank.value).toBeLessThan(100)
  }
}

// 一直照着提示做，能不能做完
function followHints(puzzle, lesson, state = startPractice(puzzle)) {
  for (let n = 0; n < 12 && !practiceSolved(state); n++) {
    const hint = nextStepHint(state, lesson.methods)
    expect(hint).toBeTruthy()
    expect(lesson.methods).toContain(hint.method)
    const res = planStep(state, hint)
    expect(res.ok).toBe(true)
    expectStepLines(res.step, puzzle.answer)
    state = res.step.next
  }
  expect(practiceSolved(state)).toBe(true)
  expect(Object.fromEntries(foundList(state).map((f) => [f.item, f.value]))).toEqual(puzzle.answer)
  return state
}

const pair = (a, b) => makeBoard(['apple', 'banana'], [makeScale('A', a.counts, a.right, a.blocks), makeScale('B', b.counts, b.right, b.blocks)])
const reasonOf = (board, choice) => planStep(startPractice({ board }), choice).reason?.code

describe('practice: the child writes every step', () => {
  for (const lesson of LESSONS) {
    it(`lesson ${lesson.id}: a child who follows the step hints always finishes`, () => {
      followHints(exampleOf(lesson.id).puzzle, lesson)
      for (let seed = 1; seed <= 100; seed++) {
        for (const problem of generateLevel(lesson, seed)) followHints(problem, lesson)
      }
    })
  }

  it('says why a step cannot be done, without choosing for the child', () => {
    const one = makeBoard(['apple'], [makeScale('A', { apple: 2 }, 11, [3])])
    expect(reasonOf(one, { method: 'share', scale: 'A', number: 2 })).toBe('shareBlocks')
    expect(reasonOf(one, { method: 'takeAway', scale: 'A', number: 5 })).toBe('takeAmount')
    expect(reasonOf(one, { method: 'takeAway', scale: 'A' })).toBe('pick')
    const plainOne = makeBoard(['apple'], [makeScale('A', { apple: 3 }, 12)])
    expect(reasonOf(plainOne, { method: 'share', scale: 'A', number: 2 })).toBe('shareN')
    expect(reasonOf(plainOne, { method: 'share', scale: 'A', number: 1 })).toBe('shareOne')
    expect(reasonOf(plainOne, { method: 'takeAway', scale: 'A', number: 3 })).toBe('takeNone')

    const lesson5 = pair({ counts: { apple: 2, banana: 1 }, right: 13 }, { counts: { apple: 1, banana: 2 }, right: 14 })
    expect(reasonOf(lesson5, { method: 'subtract', scale: 'A', other: 'B' })).toBe('subtractMore')
    expect(reasonOf(lesson5, { method: 'subtract', scale: 'B', other: 'A' })).toBe('subtractMore')
    expect(reasonOf(lesson5, { method: 'subtract', scale: 'A', other: 'A' })).toBe('same')
    expect(reasonOf(lesson5, { method: 'substitute', scale: 'A', item: 'apple' })).toBe('subNothing')
    expect(planStep(startPractice({ board: lesson5 }), { method: 'add', scale: 'A', other: 'B' }).ok).toBe(true)

    const known = pair({ counts: { apple: 1 }, right: 4 }, { counts: { banana: 2 }, right: 10 })
    expect(reasonOf(known, { method: 'substitute', scale: 'A', item: 'apple' })).toBe('subSelf')
    expect(reasonOf(known, { method: 'substitute', scale: 'B', item: 'apple' })).toBe('subTarget')
    const same = pair({ counts: { apple: 1, banana: 1 }, right: 9 }, { counts: { apple: 1, banana: 1 }, right: 9 })
    expect(reasonOf(same, { method: 'subtract', scale: 'A', other: 'B' })).toBe('subtractSame')
    const withWeight = pair({ counts: { apple: 1, banana: 1 }, right: 9 }, { counts: { apple: 2, banana: 1 }, blocks: [2], right: 15 })
    expect(reasonOf(withWeight, { method: 'subtract', scale: 'B', other: 'A' })).toBe('columnBlocks')
  })

  it('lets the child take a different road, and still helps from where the child is', () => {
    const { lesson, puzzle } = exampleOf('5')
    let state = startPractice(puzzle)
    // 例题是先 A − C；孩子改成先 B − C，算出 🍌
    for (const choice of [
      { method: 'add', scale: 'A', other: 'B' },
      { method: 'share', scale: 'C', number: 3 },
      { method: 'subtract', scale: 'B', other: 'C' },
    ]) {
      const res = planStep(state, choice)
      expect(res.ok).toBe(true)
      state = res.step.next
    }
    expect(foundList(state)).toEqual([{ item: 'banana', value: 5, scaleId: 'B' }])
    expect(nextStepHint(state, lesson.methods)).toMatchObject({ method: 'substitute', item: 'banana' })
    followHints(puzzle, lesson, state)
  })

  it('writes the step the child chose, with the results left for the child', () => {
    const board = makeBoard(['apple'], [makeScale('A', { apple: 4 }, 20)])
    const res = planStep(startPractice({ board }), { method: 'share', scale: 'A', number: 2 })
    expect(res.ok).toBe(true)
    expect(res.step.lines.map((line) => tokensText(line.tokens))).toEqual(['4apple ÷ 2 = 20 ÷ 2', '2apple = 10'])
    expect(res.step.blanks.map((b) => `${b.id}=${b.value}`)).toEqual(['c-apple=2', 'r=10'])
  })
})
