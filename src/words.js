// 把天平和演算写成孩子能读懂的话：每一步的标题和道理、天平上飘的字、每个空的提示、
// 孩子列的步骤为什么不能这样做、下一步的提示、答案和检查。
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

  // 这一步的标题：做什么（C 的两边同时 ÷ 后面接着那个数、A 减去 C……）
  function titleText(step) {
    const info = step.info
    switch (step.kind) {
      case 'lookCompare':
        return t('look.title.compare', { big: info.big, small: info.small, extra: extraWords(info.extra) })
      case 'lookSwap':
        return t('look.title.swap', { dst: info.dst, item: itemLabel(info.item), value: money(info.value) })
      case 'share':
        return t('work.share', { id: info.id })
      case 'takeAway':
        return t('work.takeAway', { id: info.id })
      case 'compare':
        return t('work.compare', { dst: info.dst, src: info.src })
      case 'swapKnown':
        return t('work.swapKnown', { item: itemLabel(info.item), value: money(info.value), dst: info.dst })
      case 'swapBundle':
        return t('work.swapBundle', { dst: info.dst, group: groupOf(info.group), value: money(info.value) })
      default:
        return t('work.combine', { a: info.a, b: info.b })
    }
  }

  // 这一步为什么可以这样做（讲解时写在这一步里）
  function whyText(step) {
    const info = step.info
    switch (step.kind) {
      case 'lookCompare':
        return t('look.why.compare', { big: info.big, small: info.small, common: itemsWords(info.common), extra: extraWords(info.extra) })
      case 'lookSwap': {
        const params = { item: itemLabel(info.item), value: money(info.value), dst: info.dst, n: info.times, right: money(info.right), other: itemLabel(info.other) }
        return t(info.times > 1 ? 'look.why.swapMany' : 'look.why.swap', params)
      }
      case 'share': {
        const kinds = items.filter((item) => info.counts[item])
        return kinds.length === 1
          ? t('work.why.shareOne', { id: info.id, n: info.n, item: itemLabel(kinds[0]) })
          : t('work.why.shareGroup', { id: info.id, n: info.n, group: groupOf(info.group) })
      }
      case 'takeAway': {
        const params = { id: info.id, items: itemsWords(info.counts), a: money(info.amount) }
        return info.blocks.length > 1
          ? t('work.why.takeAwayMany', { ...params, blocks: info.blocks.map(money).join(' + ') })
          : t('work.why.takeAway', params)
      }
      case 'compare':
        return t('work.why.compare', { dst: info.dst, src: info.src, common: itemsWords(info.common), extra: extraWords(info.extra) })
      case 'swapKnown': {
        const params = { item: itemLabel(info.item), value: money(info.value), dst: info.dst, n: info.times }
        return t(info.times > 1 ? 'work.why.swapKnownMany' : 'work.why.swapKnown', params)
      }
      case 'swapBundle':
        return t('work.why.swapBundle', { dst: info.dst, times: info.times, group: groupOf(info.group), value: money(info.value) })
      default:
        return t('work.why.combine')
    }
  }

  // 天平两边飘出的字：这一步对天平做了什么
  function floatText(step) {
    const info = step.info
    switch (step.kind) {
      case 'lookCompare':
        return { left: null, right: `${info.a} − ${info.b}` }
      case 'lookSwap': {
        const part = info.times > 1 ? `${info.times} × ${info.value}` : `${info.value}`
        return { swap: `${itemLabel(info.item)} → ${info.value}`, left: `− ${part}`, right: `− ${part}` }
      }
      case 'share':
        return { left: `÷ ${info.n}`, right: `÷ ${info.n}` }
      case 'takeAway':
        return { left: `− ${info.amount}`, right: `− ${info.amount}` }
      case 'compare': {
        const group = groupOf(info.common)
        return { left: `− ${group.includes('+') ? `(${group})` : group}`, right: `− ${info.small}` }
      }
      case 'swapKnown':
        return { left: `${itemLabel(info.item)} → ${info.value}`, right: null }
      case 'swapBundle':
        return { left: `(${groupOf(info.group)}) → ${info.value}`, right: null }
      default:
        return { left: null, right: null }
    }
  }

  // 看图算：这一步要算的是什么（写在算术上面的一句问话）
  function askText(step) {
    const info = step.info
    if (step.kind === 'lookCompare') return t('look.ask.compare', { extra: extraWords(info.extra) })
    return t('look.ask.swap', { other: itemLabel(info.other) })
  }

  // 一个空怎么想：只给思路，不说这个空填几
  function hintText(step, blank) {
    const info = step.info
    switch (blank.role) {
      case 'lookDiff':
        return t('look.hint.compare', { a: info.a, b: info.b })
      case 'lookSwap':
        return info.times > 1
          ? t('look.hint.swapMany', { n: info.times, item: itemLabel(info.item), value: info.value, right: info.right })
          : t('look.hint.swap', { right: info.right, value: info.value })
      case 'shareCount':
        return t('work.hint.shareCount', { from: blank.from, n: blank.n, item: itemLabel(blank.item) })
      case 'subCount':
        return t('work.hint.subCount', { a: blank.a, b: blank.b, item: itemLabel(blank.item) })
      case 'addCount':
        return t('work.hint.addCount', { a: blank.a, b: blank.b, item: itemLabel(blank.item) })
      case 'divide':
        return t('work.hint.divide', { total: info.total, n: info.n })
      case 'minus':
        return t('work.hint.minus', { total: info.total, amount: info.amount })
      case 'diff':
        return t('work.hint.diff', { big: info.big, small: info.small })
      case 'swapValue':
        return t('work.hint.swapValue', { item: itemLabel(info.item) })
      default:
        return t('work.hint.sum', { ra: info.ra, rb: info.rb })
    }
  }

  const methodName = (method) => t(`method.${method}`)
  const namesOf = (list) => list.map(itemLabel).join(isZh() ? ' 和 ' : ' and ')
  const blocksText = (blocks) => blocks.map(money).join(' + ')

  // 孩子列的这一步为什么不能这样做（只说原因，不替孩子选）
  function reasonText(reason) {
    const r = reason
    switch (r.code) {
      case 'shareBlocks':
        return t('no.shareBlocks', { id: r.id, blocks: blocksText(r.blocks) })
      case 'shareN':
        return t('no.shareN', { id: r.id, left: groupOf(r.counts), n: r.n })
      case 'takeNone':
        return t('no.takeNone', { id: r.id, items: itemsWords(r.counts) })
      case 'takeAmount':
        return t('no.takeAmount', { id: r.id, blocks: blocksText(r.blocks), items: itemsWords(r.counts) })
      case 'subSelf':
        return t('no.subSelf', { id: r.id, item: itemLabel(r.item), value: money(r.value) })
      case 'subTarget':
      case 'subEmpty':
        return t(`no.${r.code}`, { id: r.id, item: itemLabel(r.item) })
      case 'columnBlocks':
        return t('no.columnBlocks', { id: r.id })
      case 'subtractMore':
        return t('no.subtractMore', { dst: r.dst, src: r.src, item: itemLabel(r.item) })
      case 'subtractSame':
        return t('no.subtractSame', { dst: r.dst, src: r.src })
      case 'lookNoContain':
        return t('no.lookNoContain', { a: r.a, b: r.b, moreA: namesOf(r.moreA), moreB: namesOf(r.moreB) })
      case 'lookMixed':
        return t('no.lookMixed', { big: r.big, small: r.small, extra: extraWords(r.extra) })
      case 'lookKnown':
        return t('no.lookKnown', { item: itemLabel(r.item), value: money(r.value) })
      case 'lookSwapRest':
        return t('no.lookSwapRest', { id: r.id, rest: itemsWords(r.rest) })
      default:
        return t(`no.${r.code}`)
    }
  }

  // 下一步的提示，第一次：怎么想（不说用哪个方法）
  function nextThink(hint) {
    const info = hint.info
    switch (hint.method) {
      case 'lookCompare':
        return t('look.think.compare', { big: info.big, small: info.small })
      case 'lookSwap':
        return t('look.think.swap', { item: itemLabel(info.item), value: money(info.value), dst: info.dst })
      case 'takeAway':
        return t('next.think.takeAway', { id: info.id, items: itemsWords(info.counts), blocks: blocksText(info.blocks) })
      case 'share': {
        const kinds = items.filter((item) => info.counts[item])
        return kinds.length === 1
          ? tt('next.think.shareOne', { id: info.id, n: info.n, item: itemLabel(kinds[0]), total: money(info.total) })
          : tt('next.think.shareGroup', { id: info.id, n: info.n, group: groupOf(info.group), total: money(info.total) })
      }
      case 'substitute':
        return t('next.think.substitute', { item: itemLabel(info.item), value: money(info.value), dst: info.dst })
      case 'subtract':
        return t('next.think.subtract', { dst: info.dst, src: info.src, common: groupOf(info.common) })
      default:
        return t('next.think.add', { a: info.a, b: info.b, moreA: namesOf(info.moreA), moreB: namesOf(info.moreB) })
    }
  }

  // 下一步的提示，第二次：用哪个方法、哪架天平
  function nextDo(hint) {
    switch (hint.method) {
      case 'lookCompare':
        return t('look.do.compare', { big: hint.scale, small: hint.other })
      case 'lookSwap':
        return t('look.do.swap', { item: itemLabel(hint.item), value: money(hint.info.value), dst: hint.scale })
      case 'takeAway':
      case 'share':
        return t(`next.do.${hint.method}`, { id: hint.scale, n: hint.number })
      case 'substitute':
        return t('next.do.substitute', { item: itemLabel(hint.item), value: money(hint.info.value), dst: hint.scale })
      case 'subtract':
        return t('next.do.subtract', { dst: hint.scale, src: hint.other })
      default:
        return t('next.do.add', { a: hint.scale, b: hint.other })
    }
  }

  return {
    groupOf,
    itemsWords,
    extraWords,
    tt,
    goalText,
    answersText,
    checkLine,
    titleText,
    whyText,
    floatText,
    askText,
    hintText,
    methodName,
    reasonText,
    nextThink,
    nextDo,
  }
}
