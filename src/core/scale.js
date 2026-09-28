// 天平模型。每架天平都是一条“线索”，也就是一个方程：
//   左盘：若干个未知的东西（counts）+ 已知重量的砝码（blocks）
//   右盘：一个写着数字的砝码（right）
// 例：{ id: 'A', counts: { apple: 2, banana: 1 }, blocks: [], right: 13 } 表示 2🍎 + 🍌 = 13
//
// 所有“侦探道具”都是等式的变形，变形后天平仍然平衡：
//   分一分（share）    两边同时平均分        ↔ 等式两边同除以一个数
//   拿走（takeAway）   两边同时拿走同样重的   ↔ 等式两边同减一个数
//   换一换（swap）     用一样重的东西替换     ↔ 代入消元
//   合一合（combine）  两架天平合成一架       ↔ 两个方程相加（加减消元）

export const MAX_SCALES = 4
const IDS = ['A', 'B', 'C', 'D', 'E', 'F']

export function gcd(a, b) {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

function cleanCounts(counts) {
  const out = {}
  for (const [item, n] of Object.entries(counts)) if (n > 0) out[item] = n
  return out
}

export function makeScale(id, counts, right, blocks = []) {
  return { id, counts: cleanCounts(counts), blocks: [...blocks], right, combined: false }
}

export function makeBoard(items, scales) {
  return { items: [...items], scales }
}

export function getScale(board, id) {
  return board.scales.find((s) => s.id === id)
}

export function itemTotal(scale) {
  return Object.values(scale.counts).reduce((sum, n) => sum + n, 0)
}

export function itemKinds(scale) {
  return Object.keys(scale.counts)
}

function replaceScale(board, id, change) {
  return { ...board, scales: board.scales.map((s) => (s.id === id ? change(s) : s)) }
}

// 左盘只剩一个东西、没有砝码：这个东西有多重就“破案”了
export function discovered(scale) {
  const kinds = itemKinds(scale)
  if (scale.blocks.length === 0 && kinds.length === 1 && scale.counts[kinds[0]] === 1) {
    return { item: kinds[0], value: scale.right }
  }
  return null
}

export function discoveredValues(board) {
  const found = {}
  for (const scale of board.scales) {
    const d = discovered(scale)
    if (d) found[d.item] = d.value
  }
  return found
}

export function isSolved(board) {
  const found = discoveredValues(board)
  return board.items.every((item) => item in found)
}

// 分一分：左盘的东西能平均分成几份（大于 1 才有用），不能分就返回 0
export function shareFactor(scale) {
  if (scale.blocks.length > 0) return 0
  const counts = Object.values(scale.counts)
  if (counts.length === 0) return 0
  const g = counts.reduce(gcd)
  return g > 1 && scale.right % g === 0 ? g : 0
}

// 换一换：target 的左盘里能找出几整套 source 左盘的东西。
// 换完 target 必须还剩下东西，否则这一步没有意义，返回 0。
export function swapTimes(source, target) {
  if (!source || !target || source.id === target.id || source.blocks.length > 0) return 0
  const kinds = itemKinds(source)
  if (kinds.length === 0) return 0
  let times = Infinity
  for (const item of kinds) {
    times = Math.min(times, Math.floor((target.counts[item] || 0) / source.counts[item]))
  }
  if (!times) return 0
  return itemTotal(target) - times * itemTotal(source) > 0 ? times : 0
}

export function canCombine(board, aId, bId) {
  if (aId === bId || board.scales.length >= MAX_SCALES) return false
  const a = getScale(board, aId)
  const b = getScale(board, bId)
  return Boolean(a && b && a.blocks.length === 0 && b.blocks.length === 0)
}

export function nextScaleId(board) {
  return IDS.find((id) => !board.scales.some((s) => s.id === id))
}

export function applyShare(board, id) {
  const scale = getScale(board, id)
  const g = scale ? shareFactor(scale) : 0
  if (!g) return null
  return replaceScale(board, id, (s) => ({
    ...s,
    counts: Object.fromEntries(Object.entries(s.counts).map(([item, n]) => [item, n / g])),
    right: s.right / g,
  }))
}

export function applyTakeAway(board, id, index = 0) {
  const scale = getScale(board, id)
  if (!scale || index < 0 || index >= scale.blocks.length || itemTotal(scale) === 0) return null
  const weight = scale.blocks[index]
  return replaceScale(board, id, (s) => ({
    ...s,
    blocks: s.blocks.filter((_, i) => i !== index),
    right: s.right - weight,
  }))
}

export function applySwap(board, sourceId, targetId) {
  const source = getScale(board, sourceId)
  const target = getScale(board, targetId)
  const times = swapTimes(source, target)
  if (!times) return null
  const counts = { ...target.counts }
  for (const [item, n] of Object.entries(source.counts)) counts[item] -= times * n
  return replaceScale(board, targetId, (s) => ({
    ...s,
    counts: cleanCounts(counts),
    blocks: [...s.blocks, ...Array(times).fill(source.right)],
  }))
}

export function applyCombine(board, aId, bId) {
  if (!canCombine(board, aId, bId)) return null
  const a = getScale(board, aId)
  const b = getScale(board, bId)
  const counts = { ...a.counts }
  for (const [item, n] of Object.entries(b.counts)) counts[item] = (counts[item] || 0) + n
  const scale = { ...makeScale(nextScaleId(board), counts, a.right + b.right), combined: true }
  return { ...board, scales: [...board.scales, scale] }
}

// 这些天平一共能“锁定”几样东西（线性代数里的秩）
export function clueRank(items, scales) {
  const rows = scales.map((s) => items.map((item) => s.counts[item] || 0))
  let rank = 0
  for (let col = 0; col < items.length && rank < rows.length; col++) {
    const pivot = rows.findIndex((row, r) => r >= rank && Math.abs(row[col]) > 1e-9)
    if (pivot === -1) continue
    ;[rows[rank], rows[pivot]] = [rows[pivot], rows[rank]]
    for (let r = 0; r < rows.length; r++) {
      if (r === rank) continue
      const factor = rows[r][col] / rows[rank][col]
      for (let k = col; k < items.length; k++) rows[r][k] -= factor * rows[rank][k]
    }
    rank++
  }
  return rank
}

// 收起一架“合一合”变出来的天平：原来的线索不能收，收了会丢线索的也不能收
export function canRemove(board, id) {
  const scale = getScale(board, id)
  if (!scale || !scale.combined) return false
  const rest = board.scales.filter((s) => s.id !== id)
  return clueRank(board.items, rest) === board.items.length
}

export function applyRemove(board, id) {
  if (!canRemove(board, id)) return null
  return { ...board, scales: board.scales.filter((s) => s.id !== id) }
}

export function applyMove(board, move) {
  switch (move.type) {
    case 'share':
      return applyShare(board, move.scaleId)
    case 'takeAway':
      return applyTakeAway(board, move.scaleId, move.index ?? 0)
    case 'swap':
      return applySwap(board, move.sourceId, move.targetId)
    case 'combine':
      return applyCombine(board, move.aId, move.bId)
    case 'remove':
      return applyRemove(board, move.scaleId)
    default:
      return null
  }
}

// 用道具时，右盘要做的那道算术题。道具只负责摆天平，这道题留给孩子自己算。
// 换一换和收起不需要算，返回 null。
export function moveArithmetic(board, move) {
  if (move.type === 'share') {
    const scale = getScale(board, move.scaleId)
    const n = scale ? shareFactor(scale) : 0
    return n ? { op: '÷', a: scale.right, b: n, result: scale.right / n } : null
  }
  if (move.type === 'takeAway') {
    const scale = getScale(board, move.scaleId)
    const weight = scale?.blocks[move.index ?? 0]
    return weight === undefined ? null : { op: '−', a: scale.right, b: weight, result: scale.right - weight }
  }
  if (move.type === 'combine' && canCombine(board, move.aId, move.bId)) {
    const a = getScale(board, move.aId)
    const b = getScale(board, move.bId)
    return { op: '+', a: a.right, b: b.right, result: a.right + b.right }
  }
  return null
}

// 称一称：按孩子猜的重量，算出左盘有多重
export function leftWeight(scale, values) {
  let sum = scale.blocks.reduce((s, w) => s + w, 0)
  for (const [item, n] of Object.entries(scale.counts)) sum += n * (values[item] ?? 0)
  return sum
}

export function weighAll(board, values) {
  return board.scales.map((scale) => {
    const left = leftWeight(scale, values)
    return { id: scale.id, left, right: scale.right, balanced: left === scale.right }
  })
}

// 用来判断两道题是不是一样（不管东西换成哪种水果、天平怎么排）
export function boardSignature(board) {
  const index = Object.fromEntries(board.items.map((item, i) => [item, i]))
  return board.scales
    .map((s) => {
      const terms = Object.entries(s.counts)
        .map(([item, n]) => `${n}*${index[item]}`)
        .sort()
        .join('+')
      return `${terms}|${[...s.blocks].sort().join(',')}=${s.right}`
    })
    .sort()
    .join(';')
}
