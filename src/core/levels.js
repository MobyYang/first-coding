// 关卡配置：加新关卡只需要在这里加一段。标题和说明文字在 i18n.js 里（按关卡 id）。
// tools：本关能用的侦探道具；needs：本关一定会用到的道具
const BASIC = ['share', 'takeAway']
const WITH_SWAP = ['share', 'takeAway', 'swap']
const ALL_TOOLS = ['share', 'takeAway', 'swap', 'combine']

export const WORLDS = [
  {
    id: 'camp',
    emoji: '🏕️',
    levels: [
      { id: '1-1', kind: 'scales', template: 'single-share', theme: 'fruit', tools: ['share'], count: 3, sticker: '🦊' },
      { id: '1-2', kind: 'scales', template: 'single-take', theme: 'fruit', tools: ['takeAway'], count: 3, sticker: '🐼' },
      { id: '1-3', kind: 'scales', template: 'single-two-step', theme: 'fruit', tools: BASIC, count: 3, sticker: '🐨' },
    ],
  },
  {
    id: 'fruit',
    emoji: '🍎',
    levels: [
      { id: '2-1', kind: 'scales', template: 'pair-known', theme: 'fruit', tools: WITH_SWAP, count: 3, needs: ['swap'], sticker: '🦁' },
      { id: '2-2', kind: 'scales', template: 'pair-known-plus', theme: 'fruit', tools: WITH_SWAP, count: 3, needs: ['swap'], sticker: '🐯' },
      { id: '2-3', kind: 'scales', template: 'chain3', theme: 'fruit', tools: WITH_SWAP, count: 3, needs: ['swap'], sticker: '🐸' },
    ],
  },
  {
    id: 'compare',
    emoji: '🔍',
    levels: [
      { id: '3-1', kind: 'scales', template: 'bundle', theme: 'fruit', tools: WITH_SWAP, count: 3, needs: ['swap'], sticker: '🐙' },
      { id: '3-2', kind: 'scales', template: 'bundle-multi', theme: 'fruit', tools: WITH_SWAP, count: 3, needs: ['swap'], sticker: '🦄' },
      { id: '3-3', kind: 'scales', template: 'combine', theme: 'fruit', tools: ALL_TOOLS, count: 3, needs: ['combine'], sticker: '🐳' },
    ],
  },
  {
    id: 'story',
    emoji: '🐔',
    levels: [
      { id: '4-1', kind: 'cage', count: 3, cage: { minHeads: 5, maxHeads: 10 }, sticker: '🐰' },
      { id: '4-2', kind: 'scales', template: 'mixed', theme: 'shop', tools: ALL_TOOLS, count: 3, sticker: '🦖' },
    ],
  },
  {
    id: 'letters',
    emoji: '🔤',
    levels: [
      { id: '5-1', kind: 'scales', template: 'mixed-easy', theme: 'letters', tools: WITH_SWAP, count: 3, sticker: '🚀' },
      { id: '5-2', kind: 'scales', template: 'mixed', theme: 'letters', tools: ALL_TOOLS, count: 3, sticker: '👑' },
    ],
  },
]

export const LEVELS = WORLDS.flatMap((world) => world.levels.map((level) => ({ ...level, world: world.id })))

export function findLevel(id) {
  return LEVELS.find((level) => level.id === id)
}

export function levelIndex(id) {
  return LEVELS.findIndex((level) => level.id === id)
}

// 星星：扣分 = 算错的次数 + 看提示的次数
export function starsFor(penalty) {
  if (penalty <= 1) return 3
  if (penalty <= 4) return 2
  return 1
}
