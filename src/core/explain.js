// 讲解：把解题思路变成一步一步的说明。
// 每一步记下做了什么、算式里的数和结果，以及做完这一步以后的天平（界面用它来画）。
import { applyMove, discovered, getScale, shareFactor, swapTimes } from './scale.js'
import { planSolution } from './solver.js'

function snapshot(scale) {
  return { counts: { ...scale.counts }, blocks: [...scale.blocks], right: scale.right }
}

export function explainPuzzle(puzzle, tools) {
  const plan = planSolution(puzzle.board, tools)
  if (!plan) return null
  const steps = []
  let board = puzzle.board
  let i = 0
  while (i < plan.length) {
    const move = plan[i]

    if (move.type === 'share') {
      const scale = getScale(board, move.scaleId)
      const n = shareFactor(scale)
      board = applyMove(board, move)
      const after = getScale(board, scale.id)
      steps.push({
        kind: 'share',
        scaleId: scale.id,
        counts: { ...scale.counts },
        n,
        total: scale.right,
        result: after.right,
        after: snapshot(after),
        found: discovered(after),
        board,
        event: { kind: 'share', factor: n, scaleIds: [scale.id] },
      })
      i++
      continue
    }

    if (move.type === 'takeAway') {
      // 同一架天平上连着拿走几个砝码，合成一步说
      const scale = getScale(board, move.scaleId)
      const taken = []
      while (i < plan.length && plan[i].type === 'takeAway' && plan[i].scaleId === scale.id) {
        taken.push(getScale(board, scale.id).blocks[plan[i].index ?? 0])
        board = applyMove(board, plan[i])
        i++
      }
      const after = getScale(board, scale.id)
      const amount = taken.reduce((sum, v) => sum + v, 0)
      steps.push({
        kind: 'takeAway',
        scaleId: scale.id,
        before: snapshot(scale),
        taken,
        amount,
        total: scale.right,
        result: after.right,
        after: snapshot(after),
        found: discovered(after),
        board,
        event: { kind: 'takeAway', amount, scaleIds: [scale.id] },
      })
      continue
    }

    if (move.type === 'swap') {
      const source = getScale(board, move.sourceId)
      const target = getScale(board, move.targetId)
      const times = swapTimes(source, target)
      const known = discovered(source)
      const swapped = applyMove(board, move)
      const next = plan[i + 1]
      // 比一比：目标天平比来源天平多出来的东西，重量也正好多出 target.right − source.right
      if (!known && times === 1 && target.blocks.length === 0 && next?.type === 'takeAway' && next.scaleId === target.id) {
        board = applyMove(swapped, next)
        const after = getScale(board, target.id)
        steps.push({
          kind: 'compare',
          src: source.id,
          dst: target.id,
          extra: { ...after.counts },
          big: target.right,
          small: source.right,
          result: after.right,
          after: snapshot(after),
          found: discovered(after),
          board,
          event: { kind: 'takeAway', amount: source.right, scaleIds: [target.id] },
        })
        i += 2
        continue
      }
      board = swapped
      const after = getScale(board, target.id)
      steps.push({
        kind: known ? 'swapKnown' : 'swapBundle',
        src: source.id,
        dst: target.id,
        times,
        item: known?.item,
        value: source.right,
        group: { ...source.counts },
        after: snapshot(after),
        board,
        event: { kind: 'swap', scaleIds: [target.id] },
      })
      i++
      continue
    }

    if (move.type === 'combine') {
      const a = getScale(board, move.aId)
      const b = getScale(board, move.bId)
      board = applyMove(board, move)
      const created = board.scales[board.scales.length - 1]
      steps.push({
        kind: 'combine',
        a: a.id,
        b: b.id,
        newId: created.id,
        ra: a.right,
        rb: b.right,
        result: created.right,
        after: snapshot(created),
        board,
        event: { kind: 'combine', scaleIds: [created.id] },
      })
      i++
      continue
    }

    board = applyMove(board, move)
    steps.push({ kind: 'remove', scaleId: move.scaleId, board, event: null })
    i++
  }
  return steps
}

// 检查：把答案放回原来的每架天平，左边算出来要和右边一样
export function checkWithAnswer(board, answer) {
  return board.scales.map((scale) => {
    const terms = board.items.filter((item) => scale.counts[item]).map((item) => ({ item, count: scale.counts[item], value: answer[item] }))
    const left = terms.reduce((sum, term) => sum + term.count * term.value, 0) + scale.blocks.reduce((sum, w) => sum + w, 0)
    return { id: scale.id, terms, blocks: [...scale.blocks], left, right: scale.right, ok: left === scale.right }
  })
}
