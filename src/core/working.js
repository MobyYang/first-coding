// 例题的演算：按解题程序把每一步写成孩子在本子上会写的样子（练习时孩子自己列步骤，见 practice.js）。
// 每一步：第几步、做什么（标题）、几行算式（数字步骤）。加起来、减掉用竖式写，🍎 对着 🍎、🍌 对着 🍌。
// 前面写过的步骤一直留着；标了 blank 的数是这一步算出来的，例题里用绿色标出。
import { checkWithAnswer, explainPuzzle } from './explain.js'
import { getScale } from './scale.js'
import { eq, inParens, joinPlus, leftTokens, num, op, plain, ref, term } from './tokens.js'

// display：每架天平现在写成什么样（代入以后写成 4 + 🍌，后面接着这样写）
function buildStep(items, step, before, display) {
  switch (step.kind) {
    // C 的两边同时 ÷ 3：(3🍎 + 3🍌) ÷ 3 = 27 ÷ 3 → 🍎 + 🍌 = 9
    case 'share': {
      const id = step.scaleId
      const after = leftTokens(items, step.after.counts)
      const lines = [
        eq(id, [...inParens(display[id]), op('÷'), ref('n', step.n)], [num(step.total), op('÷'), ref('n', step.n)]),
        eq(id, after, [num(step.result, 'r')]),
      ]
      display[id] = after
      return {
        scaleId: id,
        info: { id, counts: step.counts, group: step.after.counts, n: step.n, total: step.total },
        titleNumber: num(step.n, 'n'),
        lines,
        blanks: [
          { id: 'n', value: step.n, role: 'shareN' },
          { id: 'r', value: step.result, role: 'divide' },
        ],
      }
    }

    // A 的两边同时 − 3：2🍎 + 3 − 3 = 11 − 3 → 2🍎 = 8
    case 'takeAway': {
      const id = step.scaleId
      const after = leftTokens(items, step.after.counts, step.after.blocks)
      const lines = [
        eq(id, [...display[id], op('−'), ref('a', step.amount)], [num(step.total), op('−'), ref('a', step.amount)]),
        eq(id, after, [num(step.result, 'r')]),
      ]
      display[id] = after
      return {
        scaleId: id,
        info: { id, counts: step.after.counts, blocks: step.taken, amount: step.amount, total: step.total },
        titleNumber: num(step.amount, 'a'),
        lines,
        blanks: [
          { id: 'a', value: step.amount, role: 'takeAmount' },
          { id: 'r', value: step.result, role: 'minus' },
        ],
      }
    }

    // A 减去 C（竖式）：左边减左边，右边减右边，一样的东西减掉了
    case 'compare': {
      const big = getScale(before, step.dst)
      const small = getScale(before, step.src)
      const lines = [
        {
          kind: 'column',
          op: '−',
          rows: [
            { tag: big.id, counts: { ...big.counts }, right: big.right },
            { tag: small.id, counts: { ...small.counts }, right: small.right },
          ],
          result: { tag: big.id, counts: { ...step.extra }, countBlanks: {}, right: num(step.result, 'r') },
        },
      ]
      display[big.id] = leftTokens(items, step.extra)
      return {
        scaleId: big.id,
        info: { src: small.id, dst: big.id, extra: step.extra, common: small.counts, big: big.right, small: small.right },
        titleNumber: null,
        lines,
        blanks: [{ id: 'r', value: step.result, role: 'diff' }],
      }
    }

    // 把 🍎 = 4 代入 C：🍎 + 🍌 = 9 → 4 + 🍌 = 9（换掉的东西写在原来的位置上）
    case 'swapKnown': {
      const target = getScale(before, step.dst)
      const current = display[step.dst]
      const swapped = current.flatMap((tok) => {
        if (tok.type !== 'item' || tok.item !== step.item) return [tok]
        return tok.count === 1 ? [num(step.value, 'v')] : [num(tok.count), op('×'), num(step.value, 'v')]
      })
      display[step.dst] = plain(swapped)
      return {
        scaleId: step.dst,
        info: { src: step.src, dst: step.dst, item: step.item, value: step.value, times: target.counts[step.item] },
        titleNumber: null,
        lines: [eq(step.dst, current, [num(target.right)]), eq(step.dst, swapped, [num(target.right)])],
        blanks: [{ id: 'v', value: step.value, role: 'swapValue' }],
      }
    }

    // 把（x + y）= 9 代入 B：3x + 2y = 22 → x + (x + y) + (x + y) = 22 → x + 9 + 9 = 22
    case 'swapBundle': {
      const target = getScale(before, step.dst)
      const rest = { ...target.counts }
      for (const [item, n] of Object.entries(step.group)) rest[item] -= n * step.times
      const terms = items.filter((item) => rest[item] > 0).map((item) => term(item, rest[item]))
      const blocks = target.blocks.map((w) => num(w))
      const sets = Array.from({ length: step.times }, () => [op('('), ...leftTokens(items, step.group), op(')')])
      const values = Array.from({ length: step.times }, (_, k) => (k === 0 ? num(step.value, 'v') : ref('v', step.value)))
      const swapped = joinPlus([...terms, ...values, ...blocks])
      const lines = [
        eq(step.dst, display[step.dst], [num(target.right)]),
        eq(step.dst, joinPlus([...terms, ...sets, ...blocks]), [num(target.right)]),
        eq(step.dst, swapped, [num(target.right)]),
      ]
      display[step.dst] = plain(swapped)
      return {
        scaleId: step.dst,
        info: { src: step.src, dst: step.dst, group: step.group, times: step.times, value: step.value },
        titleNumber: null,
        lines,
        blanks: [{ id: 'v', value: step.value, role: 'bundleValue' }],
      }
    }

    // 把 A 和 B 加起来（竖式）：左边加左边，右边加右边
    case 'combine': {
      const a = getScale(before, step.a)
      const b = getScale(before, step.b)
      const sum = step.after.counts
      const kinds = items.filter((item) => sum[item] > 1)
      const lines = [
        {
          kind: 'column',
          op: '+',
          rows: [
            { tag: a.id, counts: { ...a.counts }, right: a.right },
            { tag: b.id, counts: { ...b.counts }, right: b.right },
          ],
          result: {
            tag: step.newId,
            counts: { ...sum },
            countBlanks: Object.fromEntries(kinds.map((item) => [item, `c-${item}`])),
            right: num(step.result, 'r'),
          },
        },
      ]
      display[step.newId] = leftTokens(items, sum)
      return {
        scaleId: step.newId,
        info: { a: a.id, b: b.id, ra: a.right, rb: b.right },
        titleNumber: null,
        lines,
        blanks: [
          ...kinds.map((item) => ({ id: `c-${item}`, value: sum[item], role: 'count', item })),
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
  const display = Object.fromEntries(puzzle.board.scales.map((s) => [s.id, leftTokens(items, s.counts, s.blocks)]))
  const steps = []
  let before = puzzle.board
  for (const step of explained) {
    const row = buildStep(items, step, before, display)
    if (row) {
      steps.push({
        ...row,
        kind: step.kind,
        board: step.board,
        found: step.found || null,
        // 这一步变的是哪架天平：变之前、变之后。合起来的天平是新出来的：之前是加起来的那两架
        visual: {
          before: step.kind === 'combine' ? null : getScale(before, row.scaleId),
          after: getScale(step.board, row.scaleId),
          sources: step.kind === 'combine' ? [getScale(before, step.a), getScale(before, step.b)] : null,
        },
      })
    } else if (steps.length) steps[steps.length - 1].board = step.board
    before = step.board
  }
  return {
    items,
    board: puzzle.board,
    given: puzzle.board.scales.map((scale) => ({
      scaleId: scale.id,
      tokens: [...leftTokens(items, scale.counts, scale.blocks), op('='), num(scale.right)],
    })),
    steps,
    answer: puzzle.answer,
    checks: checkWithAnswer(puzzle.board, puzzle.answer),
  }
}
