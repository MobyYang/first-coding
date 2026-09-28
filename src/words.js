// 把天平上的东西写成孩子能读懂的话。讲解、提示、检查都用它。
// 写法：一种东西说“3 个 🍎”；几种东西说“🍎 和 2 个 🍌”；括号里的一组写成算式（🍎 + 2🍌）。
import { itemLabel } from './items.js'
import { hasKey, lang, t } from './i18n.js'
import { discovered, gcd, getScale, shareFactor, swapTimes } from './core/scale.js'

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

  function listOf(values) {
    return values.map(money).join(isZh() ? ' 和 ' : ' and ')
  }

  // 天平写成算式：2🍎 + 🍌 + 5 = 13
  function eqText(scale) {
    const left = [groupOf(scale.counts), ...scale.blocks.map(money)].filter(Boolean).join(' + ')
    return `${left} = ${money(scale.right)}`
  }

  function tt(key, params = {}) {
    return t(theme === 'shop' && hasKey(`${key}.shop`) ? `${key}.shop` : key, params)
  }

  function namesOf(list) {
    return list.map(itemLabel).join(isZh() ? ' 和 ' : ' and ')
  }

  function unknowns() {
    return namesOf(items)
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

  // 提示：从要找的答案出发，问第一步该怎么想（不说答案）
  function thinkText(board, move) {
    if (move.type === 'share') {
      const scale = getScale(board, move.scaleId)
      const g = shareFactor(scale)
      const kinds = Object.keys(scale.counts)
      if (kinds.length === 1) return tt('think.shareOne', { id: scale.id, n: g, item: itemLabel(kinds[0]), total: scale.right })
      const group = groupOf(Object.fromEntries(Object.entries(scale.counts).map(([k, n]) => [k, n / g])))
      return tt('think.shareGroup', { id: scale.id, g, group, total: scale.right })
    }
    if (move.type === 'takeAway') {
      const scale = getScale(board, move.scaleId)
      const params = { id: scale.id, items: itemsWords(scale.counts), v: scale.blocks[move.index ?? 0], blocks: listOf(scale.blocks), total: scale.right }
      return tt(scale.blocks.length > 1 ? 'think.takeAwayMany' : 'think.takeAway', params)
    }
    if (move.type === 'swap') {
      const source = getScale(board, move.sourceId)
      const target = getScale(board, move.targetId)
      const times = swapTimes(source, target)
      const rest = { ...target.counts }
      for (const [item, n] of Object.entries(source.counts)) {
        rest[item] -= n * times
        if (rest[item] <= 0) delete rest[item]
      }
      const known = discovered(source)
      if (known) return tt('think.swapKnown', { src: source.id, dst: target.id, item: itemLabel(known.item), rest: itemsWords(rest) })
      if (times === 1 && target.blocks.length === 0) return tt('think.swapCompare', { src: source.id, dst: target.id, extra: extraWords(rest) })
      return tt('think.swapBundle', { src: source.id, dst: target.id, k: times, group: groupOf(source.counts), w: source.right, rest: itemsWords(rest) })
    }
    if (move.type === 'combine') {
      const a = getScale(board, move.aId)
      const b = getScale(board, move.bId)
      const sum = { ...a.counts }
      for (const [item, n] of Object.entries(b.counts)) sum[item] = (sum[item] || 0) + n
      const g = Object.values(sum).reduce(gcd)
      const group = groupOf(Object.fromEntries(Object.entries(sum).map(([k, n]) => [k, n / g])))
      // 先说为什么要合起来：一架这样东西多，另一架那样东西多，没法直接比一比
      const moreA = items.filter((item) => (a.counts[item] || 0) > (b.counts[item] || 0))
      const moreB = items.filter((item) => (b.counts[item] || 0) > (a.counts[item] || 0))
      const why =
        moreA.length && moreB.length
          ? t('think.combineWhy', { a: a.id, b: b.id, moreA: namesOf(moreA), moreB: namesOf(moreB) })
          : ''
      return [why, tt('think.combine', { g, group })].filter(Boolean).join(isZh() ? '' : ' ')
    }
    return t('think.remove')
  }

  // 讲解的一步：做了什么 + 算式 + 结果
  function stepText(step) {
    if (step.kind === 'share') {
      const kinds = Object.keys(step.counts)
      if (kinds.length === 1) {
        return tt('step.shareOne', { id: step.scaleId, n: step.n, item: itemLabel(kinds[0]), total: step.total, result: step.result })
      }
      return tt('step.shareGroup', { id: step.scaleId, g: step.n, group: groupOf(step.after.counts), total: step.total, result: step.result })
    }
    if (step.kind === 'takeAway') {
      const params = { id: step.scaleId, amount: step.amount, total: step.total, result: step.result, rest: itemsWords(step.after.counts) }
      return step.found
        ? tt('step.takeAwayFound', { ...params, item: itemLabel(step.found.item) })
        : tt('step.takeAway', params)
    }
    if (step.kind === 'compare') {
      const params = { src: step.src, dst: step.dst, big: step.big, small: step.small, result: step.result }
      return step.found
        ? tt('step.compareFound', { ...params, item: itemLabel(step.found.item) })
        : tt('step.compare', { ...params, extra: itemsWords(step.extra) })
    }
    if (step.kind === 'swapKnown') {
      const params = { item: itemLabel(step.item), value: step.value, dst: step.dst, times: step.times, eq: eqText(step.after) }
      return tt(step.times > 1 ? 'step.swapKnownMany' : 'step.swapKnown', params)
    }
    if (step.kind === 'swapBundle') {
      return tt('step.swapBundle', { dst: step.dst, times: step.times, group: groupOf(step.group), value: step.value, eq: eqText(step.after) })
    }
    if (step.kind === 'combine') {
      return tt('step.combine', { a: step.a, b: step.b, ra: step.ra, rb: step.rb, result: step.result, newId: step.newId, eq: eqText(step.after) })
    }
    return t('step.remove', { id: step.scaleId })
  }

  return { groupOf, itemsWords, eqText, tt, unknowns, answersText, checkLine, thinkText, stepText }
}
