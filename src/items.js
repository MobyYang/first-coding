// 每种“神秘东西”怎么显示：水果和零食用 emoji，第 5 章用字母 x、y
export const ITEMS = {
  apple: { emoji: '🍎', zh: '苹果', en: 'apple' },
  banana: { emoji: '🍌', zh: '香蕉', en: 'banana' },
  grapes: { emoji: '🍇', zh: '葡萄', en: 'grapes' },
  strawberry: { emoji: '🍓', zh: '草莓', en: 'strawberry' },
  watermelon: { emoji: '🍉', zh: '西瓜', en: 'watermelon' },
  pear: { emoji: '🍐', zh: '梨', en: 'pear' },
  cherry: { emoji: '🍒', zh: '樱桃', en: 'cherries' },
  peach: { emoji: '🍑', zh: '桃子', en: 'peach' },
  lemon: { emoji: '🍋', zh: '柠檬', en: 'lemon' },
  icecream: { emoji: '🍦', zh: '冰淇淋', en: 'ice cream' },
  juice: { emoji: '🧃', zh: '果汁', en: 'juice box' },
  donut: { emoji: '🍩', zh: '甜甜圈', en: 'donut' },
  lollipop: { emoji: '🍭', zh: '棒棒糖', en: 'lollipop' },
  cookie: { emoji: '🍪', zh: '饼干', en: 'cookie' },
  cupcake: { emoji: '🧁', zh: '纸杯蛋糕', en: 'cupcake' },
  x: { letter: 'x', zh: 'x', en: 'x', color: '#1b8d98' },
  y: { letter: 'y', zh: 'y', en: 'y', color: '#e2553a' },
}

export function itemLabel(item) {
  const info = ITEMS[item]
  return info.emoji || info.letter
}

// 把一架天平写成算式的各个部分，例如 2🍎 + 🍌 + 9 = 13
export function equationParts(scale, items) {
  const parts = []
  for (const item of items) {
    const n = scale.counts[item]
    if (n) parts.push({ kind: 'term', item, count: n })
  }
  for (const weight of scale.blocks) parts.push({ kind: 'num', value: weight })
  return { left: parts, right: scale.right }
}
