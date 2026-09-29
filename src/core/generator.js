// 出题器：先定好每样东西有多重（答案），再按模板摆出天平（题目）。
// 这样答案一定是整数；每道题还会用 solver 走一遍，确认本关的道具能解开。
import { makeRng } from './random.js'
import { boardSignature, discovered, makeBoard, makeScale } from './scale.js'
import { planSolution } from './solver.js'

export const MAX_RIGHT = 60

export const THEMES = {
  fruit: ['apple', 'banana', 'grapes', 'strawberry', 'watermelon', 'pear', 'cherry', 'peach', 'lemon'],
  shop: ['icecream', 'juice', 'donut', 'lollipop', 'cookie', 'cupcake'],
  letters: ['x', 'y'],
}

function distinctInts(rng, count, min, max) {
  const values = new Set()
  while (values.size < count) values.add(rng.int(min, max))
  return [...values]
}

// 每个模板返回 values（按东西的序号）和 clues（每架天平左盘：counts 按序号、blocks 是砝码）
export const TEMPLATES = {
  // 3🍎 = 12
  'single-share'(rng) {
    return { values: [rng.int(2, 9)], clues: [{ counts: [rng.int(2, 5)] }] }
  },
  // 🍎 + 5 = 9
  'single-take'(rng) {
    return { values: [rng.int(2, 9)], clues: [{ counts: [1], blocks: [rng.int(2, 9)] }] }
  },
  // 2🍎 + 3 = 11
  'single-two-step'(rng) {
    return { values: [rng.int(2, 9)], clues: [{ counts: [rng.int(2, 4)], blocks: [rng.int(1, 9)] }] }
  },
  // 3🍎 = 12，🍎 + 2🍌 = 14
  'pair-known'(rng) {
    return {
      values: distinctInts(rng, 2, 2, 9),
      clues: rng.shuffle([{ counts: [rng.int(2, 3), 0] }, { counts: [1, rng.int(1, 2)] }]),
    }
  },
  // 2🍎 = 8，2🍎 + 🍌 = 13
  'pair-known-plus'(rng) {
    const other = rng.pick([[2, 1], [1, 2], [2, 2], [3, 1], [1, 3], [2, 3]])
    return {
      values: distinctInts(rng, 2, 2, 9),
      clues: rng.shuffle([{ counts: [rng.int(2, 3), 0] }, { counts: other }]),
    }
  },
  // 2🍎 = 10，🍎 + 🍌 = 8，🍌 + 🍇 = 11
  chain3(rng) {
    return {
      values: distinctInts(rng, 3, 2, 9),
      clues: rng.shuffle([
        { counts: [rng.int(2, 3), 0, 0] },
        { counts: [1, rng.int(1, 2), 0] },
        { counts: [0, 1, rng.int(1, 2)] },
      ]),
    }
  },
  // 🍎 + 🍌 = 9，2🍎 + 🍌 = 13：大天平里藏着一整套小天平
  bundle(rng) {
    return {
      values: distinctInts(rng, 2, 2, 9),
      clues: rng.shuffle([{ counts: [1, 1] }, { counts: rng.pick([[2, 1], [1, 2]]) }]),
    }
  },
  // 🍎 + 🍌 = 9，3🍎 + 2🍌 = 22：要换好几次
  'bundle-multi'(rng) {
    const pair = rng.pick([
      [[1, 1], [3, 1]],
      [[1, 1], [1, 3]],
      [[1, 1], [3, 2]],
      [[1, 1], [2, 3]],
      [[2, 1], [3, 2]],
      [[1, 2], [2, 3]],
    ])
    return { values: distinctInts(rng, 2, 2, 8), clues: rng.shuffle(pair.map((counts) => ({ counts }))) }
  },
  // 2🍎 + 🍌 = 13，🍎 + 2🍌 = 14：谁也不包含谁，要先两式相加
  combine(rng) {
    const pair = rng.pick([
      [[2, 1], [1, 2]],
      [[3, 1], [1, 3]],
      [[3, 2], [2, 3]],
    ])
    return { values: distinctInts(rng, 2, 2, 6), clues: rng.shuffle(pair.map((counts) => ({ counts }))) }
  },
}

const MIXES = {
  'single-mixed': ['single-take', 'single-two-step'],
  'mixed-easy': ['pair-known', 'pair-known-plus', 'bundle'],
  mixed: ['pair-known-plus', 'bundle', 'bundle-multi', 'combine'],
}

function resolveTemplate(name, rng, tools) {
  if (!MIXES[name]) return name
  const options = MIXES[name].filter((t) => t !== 'combine' || tools.includes('combine'))
  return rng.pick(options)
}

function pickItems(theme, count, rng) {
  const pool = THEMES[theme]
  if (theme === 'letters') return pool.slice(0, count)
  return rng.shuffle(pool).slice(0, count)
}

export function buildPuzzle(templateName, values, clues, items) {
  const ids = ['A', 'B', 'C', 'D']
  const scales = clues.map((clue, i) => {
    const counts = {}
    clue.counts.forEach((n, k) => {
      if (n) counts[items[k]] = n
    })
    const blocks = clue.blocks || []
    const right =
      clue.counts.reduce((sum, n, k) => sum + n * values[k], 0) + blocks.reduce((sum, w) => sum + w, 0)
    return makeScale(ids[i], counts, right, blocks)
  })
  const answer = Object.fromEntries(items.map((item, k) => [item, values[k]]))
  return { template: templateName, items, answer, board: makeBoard(items, scales) }
}

export function generatePuzzle(level, rng) {
  for (let attempt = 0; attempt < 200; attempt++) {
    const templateName = resolveTemplate(level.template, rng, level.tools)
    const { values, clues } = TEMPLATES[templateName](rng)
    const items = pickItems(level.theme, values.length, rng)
    const puzzle = buildPuzzle(templateName, values, clues, items)
    const { scales } = puzzle.board
    const totalRight = scales.reduce((sum, s) => sum + s.right, 0)
    if (scales.some((s) => s.right > MAX_RIGHT) || totalRight > MAX_RIGHT * 2) continue
    if (templateName === 'combine' && totalRight > MAX_RIGHT) continue
    if (scales.some((s) => discovered(s))) continue
    if (!planSolution(puzzle.board, level.tools)) continue
    return puzzle
  }
  throw new Error(`Could not generate a puzzle for level ${level.id}`)
}

export function generateLevel(level, seed) {
  const rng = makeRng(seed)
  const puzzles = []
  const seen = new Set()
  for (let attempt = 0; puzzles.length < level.count && attempt < 400; attempt++) {
    const puzzle = generatePuzzle(level, rng)
    const signature = boardSignature(puzzle.board)
    if (seen.has(signature)) continue
    seen.add(signature)
    puzzles.push(puzzle)
  }
  return puzzles
}

// 题库：一道接一道出新题，想做多少做多少（同一次里尽量不出一样的题）
export function puzzleStream(level, seed) {
  const rng = makeRng(seed)
  const seen = new Set()
  return function next() {
    let puzzle = null
    for (let attempt = 0; attempt < 30; attempt++) {
      puzzle = generatePuzzle(level, rng)
      const signature = boardSignature(puzzle.board)
      if (!seen.has(signature)) {
        seen.add(signature)
        break
      }
    }
    return puzzle
  }
}
