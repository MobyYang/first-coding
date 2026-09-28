// 练习：孩子自己列步骤。
// 每一步孩子先想好做什么：选方法、选天平、写数。这里检查这一步能不能这样做——不能做就说为什么，不替孩子选；
// 能做就写出这一步的算式，结果里变了的数空着，让孩子自己算。
// 提示从“下一步做什么”入手：看孩子现在写到哪儿，先问怎么想，再说用哪个方法、哪架天平。
import { checkWithAnswer } from './explain.js'
import { discovered, getScale, isSolved, makeScale, nextScaleId, shareFactor } from './scale.js'
import { nextMove } from './solver.js'
import { eq, inParens, leftTokens, num, op, plain, term, joinPlus } from './tokens.js'

// 孩子能选的方法（按课本的顺序）
export const METHODS = ['share', 'takeAway', 'substitute', 'subtract', 'add']
const TOOL_OF = { share: 'share', takeAway: 'takeAway', substitute: 'swap', subtract: 'swap', add: 'combine' }

// state：{ board, display }；display 是每架天平现在写成什么样（代入以后写成 4 + 🍌）
export function startPractice(puzzle) {
  const { items, scales } = puzzle.board
  return { board: puzzle.board, display: Object.fromEntries(scales.map((s) => [s.id, leftTokens(items, s.counts, s.blocks)])) }
}

export const practiceSolved = (state) => isSolved(state.board)

// 演算纸上的题目部分：题目里的每架天平和算式，最后的检查
export function problemSheet(puzzle) {
  const state = startPractice(puzzle)
  return {
    items: puzzle.items,
    board: puzzle.board,
    given: currentLines(state).map(({ scale, tokens }) => ({ scaleId: scale.id, tokens })),
    answer: puzzle.answer,
    checks: checkWithAnswer(puzzle.board, puzzle.answer),
  }
}

// 每架天平现在的算式
export function currentLines(state) {
  return state.board.scales.map((scale) => ({ scale, tokens: [...state.display[scale.id], op('='), num(scale.right)] }))
}

// 已经算出来的东西：🍎 = 5（在天平 A 上）
export function foundList(state) {
  const out = []
  for (const scale of state.board.scales) {
    const d = discovered(scale)
    if (d && !out.some((f) => f.item === d.item)) out.push({ ...d, scaleId: scale.id })
  }
  return out
}

const fail = (code, data = {}) => ({ ok: false, reason: { code, ...data } })
const sumOf = (list) => list.reduce((s, w) => s + w, 0)

// 结果那一行：变了的个数（2 个以上）留空，1 个就写东西本身
function resultLeft(items, counts, blankCounts) {
  return joinPlus(items.filter((item) => counts[item]).map((item) => term(item, counts[item], blankCounts && counts[item] > 1 ? `c-${item}` : undefined)))
}

function countBlanks(items, counts, role, data) {
  return items.filter((item) => counts[item] > 1).map((item) => ({ id: `c-${item}`, value: counts[item], role, item, ...data(item) }))
}

function column(opText, top, bottom, resultTag, counts, right, items) {
  return {
    kind: 'column',
    op: opText,
    rows: [
      { tag: top.id, counts: { ...top.counts }, right: top.right },
      { tag: bottom.id, counts: { ...bottom.counts }, right: bottom.right },
    ],
    result: {
      tag: resultTag,
      counts: { ...counts },
      countBlanks: Object.fromEntries(items.filter((item) => counts[item] > 1).map((item) => [item, `c-${item}`])),
      right: num(right, 'r'),
    },
  }
}

// 换掉一架天平（它变成了新的样子），或者加上一架新天平
function nextState(state, after, display, added = false) {
  const scales = added ? [...state.board.scales, after] : state.board.scales.map((s) => (s.id === after.id ? after : s))
  return { board: { ...state.board, scales }, display: { ...state.display, [after.id]: display } }
}

function step(state, spec) {
  const { after, display, added, before, sources, ...rest } = spec
  return {
    ok: true,
    step: {
      ...rest,
      scaleId: after.id,
      visual: { before: before || null, after, sources: sources || null },
      found: discovered(after),
      next: nextState(state, after, display, added),
    },
  }
}

// choice：{ method, scale, other, item, number }
export function planStep(state, choice) {
  const { board, display } = state
  const items = board.items
  const x = getScale(board, choice.scale)
  switch (choice.method) {
    // A 的两边同时 ÷ n：左边每样东西、右边的数都要能正好分成 n 份
    case 'share': {
      const n = choice.number
      if (!x || !n) return fail('pick')
      if (x.blocks.length) return fail('shareBlocks', { id: x.id, blocks: x.blocks })
      if (n < 2) return fail('shareOne')
      if (Object.values(x.counts).some((c) => c % n) || x.right % n) return fail('shareN', { id: x.id, counts: x.counts, n })
      const counts = Object.fromEntries(Object.entries(x.counts).map(([item, c]) => [item, c / n]))
      const after = { ...x, counts, right: x.right / n }
      const left = resultLeft(items, counts, true)
      return step(state, {
        kind: 'share',
        before: x,
        after,
        info: { id: x.id, counts: x.counts, group: counts, n, total: x.right },
        titleNumber: num(n),
        lines: [
          eq(x.id, [...inParens(display[x.id]), op('÷'), num(n)], [num(x.right), op('÷'), num(n)]),
          eq(x.id, left, [num(after.right, 'r')]),
        ],
        blanks: [
          ...countBlanks(items, counts, 'shareCount', (item) => ({ from: x.counts[item], n })),
          { id: 'r', value: after.right, role: 'divide' },
        ],
        display: plain(left),
      })
    }

    // A 的两边同时 − a：拿走左边的砝码（全部，或者其中一个）
    case 'takeAway': {
      const a = choice.number
      if (!x || !a) return fail('pick')
      if (!x.blocks.length) return fail('takeNone', { id: x.id, counts: x.counts })
      let blocks
      if (a === sumOf(x.blocks)) blocks = []
      else if (x.blocks.includes(a)) blocks = x.blocks.filter((_, k) => k !== x.blocks.indexOf(a))
      else return fail('takeAmount', { id: x.id, blocks: x.blocks, counts: x.counts })
      const after = { ...x, blocks, right: x.right - a }
      const left = leftTokens(items, x.counts, blocks)
      return step(state, {
        kind: 'takeAway',
        before: x,
        after,
        info: { id: x.id, counts: x.counts, blocks: blocks.length ? [a] : x.blocks, amount: a, total: x.right },
        titleNumber: num(a),
        lines: [
          eq(x.id, [...display[x.id], op('−'), num(a)], [num(x.right), op('−'), num(a)]),
          eq(x.id, left, [num(after.right, 'r')]),
        ],
        blanks: [{ id: 'r', value: after.right, role: 'minus' }],
        display: left,
      })
    }

    // 把 🍎 = 5 代入 B：B 上的 🍎 换成 5
    case 'substitute': {
      const found = foundList(state)
      if (!found.length) return fail('subNothing')
      const f = found.find((one) => one.item === choice.item)
      if (!f || !x) return fail('pick')
      if (x.id === f.scaleId) return fail('subSelf', { id: x.id, item: f.item, value: f.value })
      const n = x.counts[f.item]
      if (!n) return fail('subTarget', { id: x.id, item: f.item })
      const counts = { ...x.counts }
      delete counts[f.item]
      if (!Object.keys(counts).length) return fail('subEmpty', { id: x.id, item: f.item })
      const after = { ...x, counts, blocks: [...x.blocks, ...Array(n).fill(f.value)] }
      const swapped = display[x.id].flatMap((tok) => {
        if (tok.type !== 'item' || tok.item !== f.item) return [tok]
        return tok.count === 1 ? [num(f.value, 'v')] : [num(tok.count), op('×'), num(f.value, 'v')]
      })
      return step(state, {
        kind: 'swapKnown',
        before: x,
        after,
        info: { src: f.scaleId, dst: x.id, item: f.item, value: f.value, times: n },
        titleNumber: null,
        lines: [eq(x.id, display[x.id], [num(x.right)]), eq(x.id, swapped, [num(x.right)])],
        blanks: [{ id: 'v', value: f.value, role: 'swapValue' }],
        display: plain(swapped),
      })
    }

    // A 减去 C（竖式）：C 的每样东西都不能比 A 多
    case 'subtract': {
      const s = getScale(board, choice.other)
      if (!x || !s) return fail('pick')
      if (x.id === s.id) return fail('same')
      const blocked = [x, s].find((sc) => sc.blocks.length)
      if (blocked) return fail('columnBlocks', { id: blocked.id })
      const more = items.find((item) => (s.counts[item] || 0) > (x.counts[item] || 0))
      if (more) return fail('subtractMore', { dst: x.id, src: s.id, item: more })
      const counts = {}
      for (const item of items) {
        const c = (x.counts[item] || 0) - (s.counts[item] || 0)
        if (c > 0) counts[item] = c
      }
      if (!Object.keys(counts).length) return fail('subtractSame', { dst: x.id, src: s.id })
      const after = { ...x, counts, blocks: [], right: x.right - s.right }
      return step(state, {
        kind: 'compare',
        before: x,
        after,
        info: { src: s.id, dst: x.id, extra: counts, common: s.counts, big: x.right, small: s.right },
        titleNumber: null,
        lines: [column('−', x, s, x.id, counts, after.right, items)],
        blanks: [
          ...countBlanks(items, counts, 'subCount', (item) => ({ a: x.counts[item] || 0, b: s.counts[item] || 0 })),
          { id: 'r', value: after.right, role: 'diff' },
        ],
        display: leftTokens(items, counts),
      })
    }

    // 把 A 和 B 加起来（竖式）：合成一架新天平
    case 'add': {
      const y = getScale(board, choice.other)
      if (!x || !y) return fail('pick')
      if (x.id === y.id) return fail('same')
      const blocked = [x, y].find((sc) => sc.blocks.length)
      if (blocked) return fail('columnBlocks', { id: blocked.id })
      const counts = {}
      for (const item of items) {
        const c = (x.counts[item] || 0) + (y.counts[item] || 0)
        if (c > 0) counts[item] = c
      }
      const created = { ...makeScale(nextScaleId(board), counts, x.right + y.right), combined: true }
      return step(state, {
        kind: 'combine',
        after: created,
        added: true,
        sources: [x, y],
        info: { a: x.id, b: y.id, ra: x.right, rb: y.right },
        titleNumber: null,
        lines: [column('+', x, y, created.id, counts, created.right, items)],
        blanks: [
          ...countBlanks(items, counts, 'addCount', (item) => ({ a: x.counts[item] || 0, b: y.counts[item] || 0 })),
          { id: 'r', value: created.right, role: 'sum' },
        ],
        display: leftTokens(items, counts),
      })
    }

    default:
      return fail('pick')
  }
}

// 下一步可以怎么做：按孩子现在写到的样子想（孩子走的路和例题不一样也行）。
// 只用这一课学过的方法；想不出来返回 null。
export function nextStepHint(state, methods) {
  const tools = [...new Set(methods.map((m) => TOOL_OF[m]))]
  const move = nextMove(state.board, tools)
  if (!move) return null
  const board = state.board
  if (move.type === 'takeAway') {
    const s = getScale(board, move.scaleId)
    return { method: 'takeAway', scale: s.id, number: sumOf(s.blocks), info: { id: s.id, counts: s.counts, blocks: s.blocks } }
  }
  if (move.type === 'share') {
    const s = getScale(board, move.scaleId)
    const n = shareFactor(s)
    const group = Object.fromEntries(Object.entries(s.counts).map(([item, c]) => [item, c / n]))
    return { method: 'share', scale: s.id, number: n, info: { id: s.id, counts: s.counts, group, n, total: s.right } }
  }
  if (move.type === 'swap') {
    const source = getScale(board, move.sourceId)
    const target = getScale(board, move.targetId)
    const known = discovered(source)
    if (known) {
      if (!methods.includes('substitute')) return null
      return { method: 'substitute', scale: target.id, item: known.item, info: { dst: target.id, item: known.item, value: known.value } }
    }
    if (!methods.includes('subtract')) return null
    return { method: 'subtract', scale: target.id, other: source.id, info: { dst: target.id, src: source.id, common: source.counts } }
  }
  if (move.type === 'combine') {
    if (!methods.includes('add')) return null
    const a = getScale(board, move.aId)
    const b = getScale(board, move.bId)
    const moreA = board.items.filter((item) => (a.counts[item] || 0) > (b.counts[item] || 0))
    const moreB = board.items.filter((item) => (b.counts[item] || 0) > (a.counts[item] || 0))
    return { method: 'add', scale: a.id, other: b.id, info: { a: a.id, b: b.id, moreA, moreB } }
  }
  return null
}
