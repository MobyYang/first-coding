// 解题思路：按优先级找下一步。
// 讲解、提示和出题器都用它：出题器用它确认每道题都能用本课的方法解出来。
import {
  MAX_SCALES,
  applyMove,
  canCombine,
  canRemove,
  discovered,
  gcd,
  isSolved,
  itemTotal,
  shareFactor,
  swapTimes,
} from './scale.js'

function combinedCounts(a, b) {
  const counts = { ...a.counts }
  for (const [item, n] of Object.entries(b.counts)) counts[item] = (counts[item] || 0) + n
  return counts
}

function sameCounts(a, b) {
  const ka = Object.keys(a)
  return ka.length === Object.keys(b).length && ka.every((k) => a[k] === b[k])
}

export function nextMove(board, tools) {
  const has = (tool) => tools.includes(tool)
  const scales = board.scales

  // 1. 左盘有砝码：两边同时拿走
  if (has('takeAway')) {
    const scale = scales.find((s) => s.blocks.length > 0 && itemTotal(s) > 0)
    if (scale) return { type: 'takeAway', scaleId: scale.id, index: 0 }
  }

  // 2. 能平均分就分（优先分完就能求出答案的）
  if (has('share')) {
    const candidates = scales.filter((s) => shareFactor(s) > 0)
    if (candidates.length > 0) {
      candidates.sort((a, b) => itemTotal(a) / shareFactor(a) - itemTotal(b) / shareFactor(b))
      return { type: 'share', scaleId: candidates[0].id }
    }
  }

  // 3. 代入：先用已经求出来的东西，再用“最大的一套”去换
  if (has('swap')) {
    let best = null
    for (const source of scales) {
      for (const target of scales) {
        if (!swapTimes(source, target)) continue
        const score = (discovered(source) ? 1000 : 0) + itemTotal(source) * 10 - itemTotal(target)
        if (!best || score > best.score) {
          best = { score, move: { type: 'swap', sourceId: source.id, targetId: target.id } }
        }
      }
    }
    if (best) return best.move
  }

  // 4. 实在没办法：把两架天平合在一起，合完要能平均分，而且不和已有的天平重复
  if (has('combine') && scales.length < MAX_SCALES) {
    for (let i = 0; i < scales.length; i++) {
      for (let j = i + 1; j < scales.length; j++) {
        const a = scales[i]
        const b = scales[j]
        if (!canCombine(board, a.id, b.id)) continue
        const counts = combinedCounts(a, b)
        const g = Object.values(counts).reduce(gcd)
        if (g <= 1) continue
        const shared = Object.fromEntries(Object.entries(counts).map(([k, n]) => [k, n / g]))
        if (scales.some((s) => s.blocks.length === 0 && sameCounts(s.counts, shared))) continue
        return { type: 'combine', aId: a.id, bId: b.id }
      }
    }
  }

  // 5. 天平摆满了还没头绪：先收起一架合出来的天平（优先收重复的），腾出地方
  const extras = scales.filter((s) => canRemove(board, s.id))
  if (extras.length > 0) {
    const duplicate = extras.find((s) =>
      scales.some((o) => o.id !== s.id && o.blocks.length === 0 && s.blocks.length === 0 && o.right === s.right && sameCounts(o.counts, s.counts)),
    )
    return { type: 'remove', scaleId: (duplicate || extras[extras.length - 1]).id }
  }

  return null
}

// 从当前的天平一路按思路走到求出全部答案，走不通返回 null
export function planSolution(board, tools, maxSteps = 24) {
  let current = board
  const moves = []
  for (let step = 0; step < maxSteps; step++) {
    if (isSolved(current)) return moves
    const move = nextMove(current, tools)
    if (!move) return null
    const next = applyMove(current, move)
    if (!next) return null
    moves.push(move)
    current = next
  }
  return isSolved(current) ? moves : null
}
