import { describe, expect, it } from 'vitest'
import { applyCage, cageHint, cageSolved, generateCageLevel } from '../src/core/cage.js'
import { MAX_RIGHT, generateLevel } from '../src/core/generator.js'
import { LEVELS } from '../src/core/levels.js'
import {
  applyCombine,
  applyMove,
  applyRemove,
  applyShare,
  applySwap,
  applyTakeAway,
  canCombine,
  canRemove,
  discoveredValues,
  isSolved,
  makeBoard,
  makeScale,
  moveArithmetic,
  shareFactor,
  swapTimes,
  weighAll,
} from '../src/core/scale.js'
import { planSolution } from '../src/core/solver.js'
import { makeRng } from '../src/core/random.js'

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

  it('leaves the arithmetic of each tool for the child', () => {
    const shareBoard = makeBoard(['apple'], [makeScale('A', { apple: 5 }, 20)])
    expect(moveArithmetic(shareBoard, { type: 'share', scaleId: 'A' })).toEqual({ op: '÷', a: 20, b: 5, result: 4 })
    const takeBoard = makeBoard(['apple'], [makeScale('A', { apple: 1 }, 9, [5])])
    expect(moveArithmetic(takeBoard, { type: 'takeAway', scaleId: 'A', index: 0 })).toEqual({ op: '−', a: 9, b: 5, result: 4 })
    const pair = makeBoard(
      ['apple', 'banana'],
      [makeScale('A', { apple: 2, banana: 1 }, 13), makeScale('B', { apple: 1, banana: 2 }, 14)],
    )
    expect(moveArithmetic(pair, { type: 'combine', aId: 'A', bId: 'B' })).toEqual({ op: '+', a: 13, b: 14, result: 27 })
    expect(moveArithmetic(pair, { type: 'swap', sourceId: 'A', targetId: 'B' })).toBeNull()
    expect(moveArithmetic(pair, { type: 'share', scaleId: 'A' })).toBeNull()
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
  for (const level of LEVELS.filter((l) => l.kind === 'scales')) {
    it(`level ${level.id}: one whole-number answer, solvable with the level's tools`, () => {
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

describe('hints after free play', () => {
  function legalMoves(board, tools) {
    const moves = []
    for (const s of board.scales) {
      if (tools.includes('share') && applyShare(board, s.id)) moves.push({ type: 'share', scaleId: s.id })
      if (tools.includes('takeAway')) s.blocks.forEach((_, index) => moves.push({ type: 'takeAway', scaleId: s.id, index }))
      if (canRemove(board, s.id)) moves.push({ type: 'remove', scaleId: s.id })
      for (const t of board.scales) {
        if (tools.includes('swap') && applySwap(board, s.id, t.id)) moves.push({ type: 'swap', sourceId: s.id, targetId: t.id })
        if (tools.includes('combine') && s.id < t.id && canCombine(board, s.id, t.id)) {
          moves.push({ type: 'combine', aId: s.id, bId: t.id })
        }
      }
    }
    return moves
  }

  it('can still find a way to the answer after random tool presses', () => {
    for (const level of LEVELS.filter((l) => l.kind === 'scales')) {
      for (let seed = 1; seed <= 40; seed++) {
        const rng = makeRng(seed * 31)
        for (const puzzle of generateLevel(level, seed)) {
          let board = puzzle.board
          for (let step = 0; step < 8 && !isSolved(board); step++) {
            board = applyMove(board, rng.pick(legalMoves(board, level.tools)))
            expect(planSolution(board, level.tools)).not.toBeNull()
          }
        }
      }
    }
  })
})

describe('chickens and rabbits', () => {
  const level = LEVELS.find((l) => l.kind === 'cage')

  it('always has a whole-number answer that the hints lead to', () => {
    for (let seed = 1; seed <= 200; seed++) {
      const puzzles = generateCageLevel(level, seed)
      expect(puzzles).toHaveLength(level.count)
      for (const puzzle of puzzles) {
        const { chickens, rabbits } = puzzle.answer
        expect(chickens).toBeGreaterThan(0)
        expect(rabbits).toBeGreaterThan(0)
        expect(chickens + rabbits).toBe(puzzle.heads)
        expect(2 * chickens + 4 * rabbits).toBe(puzzle.legs)

        let state = { chickens: 0, rabbits: 0 }
        for (let step = 0; step < 40 && !cageSolved(puzzle, state); step++) {
          state = applyCage(state, cageHint(puzzle, state).action)
        }
        expect(state).toEqual(puzzle.answer)
      }
    }
  })
})
