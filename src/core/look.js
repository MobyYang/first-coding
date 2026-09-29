// 看图算（第 4 课先试用）：不写方程，看着天平想，每一步只算一道普通的算术。
//   ⚖️ 比一比：两架天平一样的东西划掉，多出来的东西重多少，右边就多多少（14 − 10 = 4）
//   🔄 换一换：知道了一样东西有多重，换进天平里，求另一样（10 − 4 = 6）
// 天平一直是题目里的样子，每一步算出一样东西有多重（known）；都算出来就做完了。
// 例题和练习用同一套：例题就是照着下一步的提示一步一步做出来的。
import { getScale } from './scale.js'
import { num, op, ref, term, leftTokens } from './tokens.js'
import { problemSheet } from './practice.js'

export const LOOK_METHODS = ['lookCompare', 'lookSwap']

// state：{ board, known }；known 是已经算出来的，例如 { apple: 4 }
export const startLook = (puzzle) => ({ board: puzzle.board, known: {} })
export const lookSolved = (state) => state.board.items.every((item) => item in state.known)
export const lookSheet = problemSheet

export function lookLines(state) {
  const items = state.board.items
  return state.board.scales.map((scale) => ({ scale, tokens: [...leftTokens(items, scale.counts, scale.blocks), op('='), num(scale.right)] }))
}

export function lookFound(state) {
  return state.board.items.filter((item) => item in state.known).map((item) => ({ item, value: state.known[item] }))
}

const fail = (code, data = {}) => ({ ok: false, reason: { code, ...data } })
const has = (scale, item) => scale.counts[item] || 0
const contains = (items, big, small) => items.every((item) => has(big, item) >= has(small, item))

function done(state, spec) {
  const { item, value } = spec.found
  return { ok: true, step: { titleNumber: null, ...spec, next: { ...state, known: { ...state.known, [item]: value } } } }
}

// ⚖️ 比一比：谁多就是谁减谁，孩子不用管顺序。多出来的只能是 1 个东西，才能一步算出来
function compare(state, x, y) {
  const items = state.board.items
  if (!x || !y) return fail('pick')
  if (x.id === y.id) return fail('same')
  const blocked = [x, y].find((s) => s.blocks.length)
  if (blocked) return fail('columnBlocks', { id: blocked.id })
  const xBig = contains(items, x, y)
  const yBig = contains(items, y, x)
  if (xBig && yBig) return fail('subtractSame', { dst: x.id, src: y.id })
  if (!xBig && !yBig) {
    return fail('lookNoContain', {
      a: x.id,
      b: y.id,
      moreA: items.filter((item) => has(x, item) > has(y, item)),
      moreB: items.filter((item) => has(y, item) > has(x, item)),
    })
  }
  const [big, small] = xBig ? [x, y] : [y, x]
  const extra = {}
  for (const item of items) if (has(big, item) > has(small, item)) extra[item] = has(big, item) - has(small, item)
  const kinds = Object.keys(extra)
  if (kinds.length !== 1 || extra[kinds[0]] !== 1) return fail('lookMixed', { big: big.id, small: small.id, extra })
  const item = kinds[0]
  if (item in state.known) return fail('lookKnown', { item, value: state.known[item] })
  const value = big.right - small.right
  return done(state, {
    kind: 'lookCompare',
    scaleId: big.id,
    info: { big: big.id, small: small.id, extra, common: { ...small.counts }, a: big.right, b: small.right, item, value },
    lines: [
      { kind: 'ask' },
      { kind: 'eq', tag: null, tokens: [num(big.right), op('−'), num(small.right), op('='), num(value, 'r')] },
      { kind: 'eq', tag: null, lead: true, tokens: [term(item, 1), op('='), ref('r', value)] },
    ],
    blanks: [{ id: 'r', value, role: 'lookDiff' }],
    // 两架天平放在一起，一样的划掉；算对了再出现多出来的那一架
    visual: { look: 'compare', sources: [big, small], cancel: { ...small.counts }, after: { id: big.id, counts: { ...extra }, blocks: [], right: value } },
    found: { item, value },
  })
}

// 🔄 换一换：把知道的东西换成数，剩下的只能是 1 个不知道的东西
function swap(state, f, x) {
  if (!f || !x) return fail('pick')
  const n = has(x, f.item)
  if (!n) return fail('subTarget', { id: x.id, item: f.item })
  const rest = { ...x.counts }
  delete rest[f.item]
  const kinds = Object.keys(rest)
  if (!kinds.length) return fail('subEmpty', { id: x.id, item: f.item })
  if (kinds.length !== 1 || rest[kinds[0]] !== 1 || x.blocks.length) return fail('lookSwapRest', { id: x.id, rest })
  const other = kinds[0]
  if (other in state.known) return fail('lookKnown', { item: other, value: state.known[other] })
  const value = x.right - n * f.value
  const calc = n === 1 ? [num(x.right), op('−'), num(f.value)] : [num(x.right), op('−'), num(n), op('×'), num(f.value)]
  return done(state, {
    kind: 'lookSwap',
    scaleId: x.id,
    info: { dst: x.id, item: f.item, value: f.value, times: n, other, right: x.right, result: value },
    lines: [
      { kind: 'ask' },
      { kind: 'eq', tag: null, tokens: [...calc, op('='), num(value, 'r')] },
      { kind: 'eq', tag: null, lead: true, tokens: [term(other, 1), op('='), ref('r', value)] },
    ],
    blanks: [{ id: 'r', value, role: 'lookSwap' }],
    // 先是题目里的样子；知道的东西变成砝码；算对了，两边一起拿走这些砝码
    visual: {
      look: 'swap',
      before: x,
      mid: { ...x, counts: rest, blocks: Array(n).fill(f.value) },
      after: { ...x, counts: rest, blocks: [], right: value },
    },
    found: { item: other, value },
  })
}

// choice：{ method, scale, other, item }
export function planLook(state, choice) {
  const board = state.board
  const x = getScale(board, choice.scale)
  if (choice.method === 'lookCompare') return compare(state, x, getScale(board, choice.other))
  if (choice.method === 'lookSwap') {
    const found = lookFound(state)
    if (!found.length) return fail('lookNoKnown')
    return swap(state, found.find((f) => f.item === choice.item), x)
  }
  return fail('pick')
}

// 下一步可以怎么做：先看能不能换一换（知道一样，求另一样），不能就比一比。想不出来返回 null
export function lookHint(state) {
  const { scales, items } = state.board
  for (const f of lookFound(state)) {
    const targets = scales.filter((s) => swap(state, f, s).ok).sort((a, b) => has(a, f.item) - has(b, f.item))
    if (targets.length) {
      const s = targets[0]
      return { method: 'lookSwap', scale: s.id, item: f.item, info: { dst: s.id, item: f.item, value: f.value } }
    }
  }
  for (const x of scales) {
    for (const y of scales) {
      if (x.id === y.id || !contains(items, x, y)) continue
      const res = compare(state, x, y)
      if (res.ok) return { method: 'lookCompare', scale: x.id, other: y.id, info: { big: x.id, small: y.id, common: { ...y.counts } } }
    }
  }
  return null
}

// 例题：照着提示一步一步做
export function buildLookWorking(puzzle) {
  let state = startLook(puzzle)
  const steps = []
  for (let n = 0; n < 8 && !lookSolved(state); n++) {
    const hint = lookHint(state)
    if (!hint) return null
    const res = planLook(state, hint)
    if (!res.ok) return null
    steps.push(res.step)
    state = res.step.next
  }
  return lookSolved(state) ? { ...lookSheet(puzzle), steps } : null
}
