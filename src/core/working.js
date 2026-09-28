// 演算过程：把讲解的每一步写成“做什么”和“新的算式”两行，一步一步往下写，前面的步骤一直留着。
// 讲解时所有数都写出来；练习时标了 blank 的数留空，让孩子自己填。
import { checkWithAnswer, explainPuzzle } from './explain.js'
import { getScale } from './scale.js'

// 算式里的记号：
//   { type: 'item', item, count, blank? }  2🍎（有 blank：个数要孩子填）
//   { type: 'op', text }                   + − × ÷ =
//   { type: 'num', value, blank? }         一个数（有 blank：要孩子填）
//   { type: 'ref', of, value }             和“做什么”里那个空是同一个数，孩子填了才显示
const op = (text) => ({ type: 'op', text })
const num = (value, blank) => (blank ? { type: 'num', value, blank } : { type: 'num', value })
const ref = (of, value) => ({ type: 'ref', of, value })
const term = (item, count) => ({ type: 'item', item, count })

function joinPlus(parts) {
  const out = []
  parts.forEach((part, i) => {
    if (i > 0) out.push(op('+'))
    out.push(...(Array.isArray(part) ? part : [part]))
  })
  return out
}

// 左边：东西按题目里的顺序写，砝码写在后面
function leftTokens(items, counts, blocks = []) {
  const terms = items.filter((item) => counts[item]).map((item) => term(item, counts[item]))
  return joinPlus([...terms, ...blocks.map((w) => num(w))])
}

function givenTokens(items, scale) {
  return [...leftTokens(items, scale.counts, scale.blocks), op('='), num(scale.right)]
}

function buildRow(items, step, before) {
  switch (step.kind) {
    // A：两边同时 ÷ 3  →  🍎 = 12 ÷ 3 = 4
    case 'share':
      return {
        scaleId: step.scaleId,
        info: { id: step.scaleId, counts: step.counts, group: step.after.counts, n: step.n, total: step.total },
        labelNumber: num(step.n, 'n'),
        line: [...leftTokens(items, step.after.counts), op('='), num(step.total), op('÷'), ref('n', step.n), op('='), num(step.result, 'r')],
        blanks: [
          { id: 'n', value: step.n, role: 'shareN' },
          { id: 'r', value: step.result, role: 'divide' },
        ],
      }

    // A：两边同时 − 3  →  2🍎 = 11 − 3 = 8
    case 'takeAway':
      return {
        scaleId: step.scaleId,
        info: { id: step.scaleId, counts: step.after.counts, blocks: step.taken, amount: step.amount, total: step.total },
        labelNumber: num(step.amount, 'a'),
        line: [
          ...leftTokens(items, step.after.counts, step.after.blocks),
          op('='),
          num(step.total),
          op('−'),
          ref('a', step.amount),
          op('='),
          num(step.result, 'r'),
        ],
        blanks: [
          { id: 'a', value: step.amount, role: 'takeAmount' },
          { id: 'r', value: step.result, role: 'minus' },
        ],
      }

    // B 比 A 多 1 个 🍎  →  🍎 = 14 − 10 = 4
    case 'compare':
      return {
        scaleId: step.dst,
        info: { src: step.src, dst: step.dst, extra: step.extra, big: step.big, small: step.small },
        labelNumber: null,
        line: [...leftTokens(items, step.extra), op('='), num(step.big, 'big'), op('−'), num(step.small, 'small'), op('='), num(step.result, 'r')],
        blanks: [
          { id: 'big', value: step.big, role: 'big' },
          { id: 'small', value: step.small, role: 'small' },
          { id: 'r', value: step.result, role: 'diff' },
        ],
      }

    // 把 🍎 = 4 代入 A  →  4 + 🍌 = 10（换掉的东西写在原来的位置上）
    case 'swapKnown': {
      const target = getScale(before, step.dst)
      const parts = items
        .filter((item) => target.counts[item])
        .map((item) => {
          const n = target.counts[item]
          if (item !== step.item) return term(item, n)
          return n === 1 ? num(step.value, 'v') : [num(n), op('×'), num(step.value, 'v')]
        })
      return {
        scaleId: step.dst,
        info: { src: step.src, dst: step.dst, item: step.item, value: step.value },
        labelNumber: null,
        line: [...joinPlus([...parts, ...target.blocks.map((w) => num(w))]), op('='), num(target.right)],
        blanks: [{ id: 'v', value: step.value, role: 'swapValue' }],
      }
    }

    // B 里有 2 份（x + y）  →  x + 2 × 9 = 22
    case 'swapBundle': {
      const target = getScale(before, step.dst)
      const rest = { ...target.counts }
      for (const [item, n] of Object.entries(step.group)) rest[item] -= n * step.times
      const terms = items.filter((item) => rest[item] > 0).map((item) => term(item, rest[item]))
      const sets = step.times === 1 ? num(step.value, 'v') : [num(step.times), op('×'), num(step.value, 'v')]
      return {
        scaleId: step.dst,
        info: { src: step.src, dst: step.dst, group: step.group, times: step.times, value: step.value },
        labelNumber: null,
        line: [...joinPlus([...terms, sets, ...target.blocks.map((w) => num(w))]), op('='), num(target.right)],
        blanks: [{ id: 'v', value: step.value, role: 'bundleValue' }],
      }
    }

    // 把 A 和 B 加起来  →  3🍎 + 3🍌 = 13 + 14 = 27（左边加左边，右边加右边）
    case 'combine': {
      const counts = step.after.counts
      const kinds = items.filter((item) => counts[item])
      const terms = kinds.map((item) => (counts[item] > 1 ? { ...term(item, counts[item]), blank: `c-${item}` } : term(item, 1)))
      return {
        scaleId: step.newId,
        info: { a: step.a, b: step.b, ra: step.ra, rb: step.rb },
        labelNumber: null,
        line: [...joinPlus(terms), op('='), num(step.ra), op('+'), num(step.rb), op('='), num(step.result, 'r')],
        blanks: [
          ...kinds.filter((item) => counts[item] > 1).map((item) => ({ id: `c-${item}`, value: counts[item], role: 'count', item })),
          { id: 'r', value: step.result, role: 'sum' },
        ],
      }
    }

    // 收起用不着的天平：不写进演算
    default:
      return null
  }
}

export function buildWorking(puzzle, tools) {
  const explained = explainPuzzle(puzzle, tools)
  if (!explained) return null
  const items = puzzle.items
  const steps = []
  let before = puzzle.board
  for (const step of explained) {
    const row = buildRow(items, step, before)
    if (row) steps.push({ ...row, kind: step.kind, board: step.board, event: step.event, found: step.found || null })
    else if (steps.length) steps[steps.length - 1].board = step.board
    before = step.board
  }
  return {
    items,
    given: puzzle.board.scales.map((scale) => ({ scaleId: scale.id, tokens: givenTokens(items, scale) })),
    steps,
    answer: puzzle.answer,
    checks: checkWithAnswer(puzzle.board, puzzle.answer),
  }
}

// 把答案代进一行算式，算出每个等号之间的值（测试用它确认每一行都成立）
export function lineValues(tokens, answer) {
  const parts = [[]]
  for (const tok of tokens) {
    if (tok.type === 'op' && tok.text === '=') parts.push([])
    else parts[parts.length - 1].push(tok)
  }
  return parts.map((part) => {
    let total = 0
    let sign = 1
    let value = null
    let pending = null
    for (const tok of part) {
      if (tok.type === 'op') {
        if (tok.text === '+' || tok.text === '−') {
          total += sign * value
          sign = tok.text === '+' ? 1 : -1
          value = null
        } else pending = tok.text
        continue
      }
      const v = tok.type === 'item' ? tok.count * answer[tok.item] : tok.value
      if (value === null) value = v
      else if (pending === '×') value *= v
      else if (pending === '÷') value /= v
      pending = null
    }
    return total + sign * value
  })
}
