// 把天平和演算写成孩子能读懂的话：演算里每一步“做什么”、每个空的提示、答案和检查。
// 写法：一种东西说“3 个 🍎”；几种东西说“🍎 和 2 个 🍌”；括号里的一组写成算式（🍎 + 2🍌）。
import { itemLabel } from './items.js'
import { hasKey, lang, t } from './i18n.js'

export function makeWords(items, theme) {
  const isZh = () => lang() === 'zh'
  const money = (v) => (theme === 'shop' ? t('unit.yuan', { v }) : String(v))

  function groupOf(counts) {
    return items
      .filter((item) => counts[item])
      .map((item) => (counts[item] > 1 ? `${counts[item]}${itemLabel(item)}` : itemLabel(item)))
      .join(' + ')
  }

  function itemsWords(counts) {
    return items
      .filter((item) => counts[item])
      .map((item) => {
        const n = counts[item]
        if (n === 1) return itemLabel(item)
        return isZh() ? `${n} 个 ${itemLabel(item)}` : `${n} ${itemLabel(item)}`
      })
      .join(isZh() ? ' 和 ' : ' and ')
  }

  // 比一比时多出来的东西：只多 1 个就说“1 个 🍎”，比只写“🍎”好懂
  function extraWords(counts) {
    const kinds = items.filter((item) => counts[item])
    if (kinds.length === 1 && counts[kinds[0]] === 1) {
      return isZh() ? `1 个 ${itemLabel(kinds[0])}` : `one ${itemLabel(kinds[0])}`
    }
    return itemsWords(counts)
  }

  function tt(key, params = {}) {
    return t(theme === 'shop' && hasKey(`${key}.shop`) ? `${key}.shop` : key, params)
  }

  // 求：🍎 = ?，🍌 = ?
  function goalText() {
    return t('work.goal', { unknowns: items.map((item) => `${itemLabel(item)} = ?`).join(isZh() ? '，' : ', ') })
  }

  function answersText(answer) {
    return items.map((item) => `${itemLabel(item)} = ${money(answer[item])}`).join(isZh() ? '，' : ', ')
  }

  // 检查：2 × 4 + 5 = 13 ✓
  function checkLine(row) {
    const parts = row.terms.map((term) => (term.count > 1 ? `${term.count} × ${term.value}` : `${term.value}`))
    parts.push(...row.blocks.map(String))
    return `${parts.join(' + ')} = ${row.left}${row.ok ? ' ✓' : ''}`
  }

  // 演算里的一步“做什么”：A：两边同时 ÷（后面接着那个数）、B 比 A 多 1 个 🍎……
  function labelText(step) {
    const info = step.info
    switch (step.kind) {
      case 'share':
        return t('work.share', { id: info.id })
      case 'takeAway':
        return t('work.takeAway', { id: info.id })
      case 'compare':
        return t('work.compare', { dst: info.dst, src: info.src, extra: extraWords(info.extra) })
      case 'swapKnown':
        return t('work.swapKnown', { item: itemLabel(info.item), value: money(info.value), dst: info.dst })
      case 'swapBundle':
        return t('work.swapBundle', { dst: info.dst, times: info.times, group: groupOf(info.group) })
      default:
        return t('work.combine', { a: info.a, b: info.b })
    }
  }

  // 一个空怎么想：只给思路，不说这个空填几
  function hintText(step, blank) {
    const info = step.info
    switch (blank.role) {
      case 'shareN': {
        const kinds = items.filter((item) => info.counts[item])
        return kinds.length === 1
          ? t('work.hint.shareN', { id: info.id, item: itemLabel(kinds[0]) })
          : t('work.hint.shareNGroup', { id: info.id, group: groupOf(info.group) })
      }
      case 'divide':
        return t('work.hint.divide', { total: info.total, n: info.n })
      case 'takeAmount':
        return t('work.hint.takeAmount', { id: info.id, items: itemsWords(info.counts) })
      case 'minus':
        return t('work.hint.minus', { total: info.total, amount: info.amount })
      case 'big':
        return t('work.hint.big', { dst: info.dst })
      case 'small':
        return t('work.hint.small', { src: info.src })
      case 'diff':
        return t('work.hint.diff', { big: info.big, small: info.small })
      case 'swapValue':
        return t('work.hint.swapValue', { item: itemLabel(info.item) })
      case 'bundleValue':
        return t('work.hint.bundleValue', { group: groupOf(info.group), src: info.src })
      case 'count':
        return t('work.hint.count', { a: info.a, b: info.b, item: itemLabel(blank.item) })
      default:
        return t('work.hint.sum', { ra: info.ra, rb: info.rb })
    }
  }

  return { groupOf, itemsWords, extraWords, tt, goalText, answersText, checkLine, labelText, hintText }
}
