// 鸡兔同笼（出自《孙子算经》）：头数和脚数是两条线索，
// 其实就是二元一次方程组：鸡 + 兔 = 头数，2×鸡 + 4×兔 = 脚数。
import { makeRng } from './random.js'

export const MAX_ANIMALS = 12

export function makeCagePuzzle(rng, { minHeads = 5, maxHeads = 10 } = {}) {
  const heads = rng.int(minHeads, maxHeads)
  const rabbits = rng.int(1, heads - 1)
  const chickens = heads - rabbits
  return { heads, legs: 2 * chickens + 4 * rabbits, answer: { chickens, rabbits } }
}

export function generateCageLevel(level, seed) {
  const rng = makeRng(seed)
  const puzzles = []
  const seen = new Set()
  for (let attempt = 0; puzzles.length < level.count && attempt < 400; attempt++) {
    const puzzle = makeCagePuzzle(rng, level.cage)
    const key = `${puzzle.heads}/${puzzle.legs}`
    if (seen.has(key)) continue
    seen.add(key)
    puzzles.push(puzzle)
  }
  return puzzles
}

export function cageCounts({ chickens, rabbits }) {
  return { heads: chickens + rabbits, legs: 2 * chickens + 4 * rabbits }
}

export function cageSolved(puzzle, state) {
  const { heads, legs } = cageCounts(state)
  return heads === puzzle.heads && legs === puzzle.legs
}

export function applyCage(state, action) {
  const { chickens, rabbits } = state
  const room = chickens + rabbits < MAX_ANIMALS
  switch (action) {
    case 'addChicken':
      return room ? { chickens: chickens + 1, rabbits } : null
    case 'removeChicken':
      return chickens > 0 ? { chickens: chickens - 1, rabbits } : null
    case 'addRabbit':
      return room ? { chickens, rabbits: rabbits + 1 } : null
    case 'removeRabbit':
      return rabbits > 0 ? { chickens, rabbits: rabbits - 1 } : null
    case 'chickenToRabbit':
      return chickens > 0 ? { chickens: chickens - 1, rabbits: rabbits + 1 } : null
    case 'rabbitToChicken':
      return rabbits > 0 ? { chickens: chickens + 1, rabbits: rabbits - 1 } : null
    default:
      return null
  }
}

// 古人的思路：先让头数对上（假设全是鸡），再一只一只把鸡变成兔子，每变一只多 2 只脚
export function cageHint(puzzle, state) {
  const { heads, legs } = cageCounts(state)
  if (heads < puzzle.heads) return { step: 'heads-more', action: 'addChicken' }
  if (heads > puzzle.heads) {
    return { step: 'heads-fewer', action: state.rabbits > 0 ? 'removeRabbit' : 'removeChicken' }
  }
  if (legs < puzzle.legs) return { step: 'legs-more', action: 'chickenToRabbit', missing: puzzle.legs - legs }
  if (legs > puzzle.legs) return { step: 'legs-fewer', action: 'rabbitToChicken', extra: legs - puzzle.legs }
  return null
}
