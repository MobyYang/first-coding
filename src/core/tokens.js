// 演算里的记号：例题的演算（working.js）和孩子自己列的步骤（practice.js）都用它。
//   { type: 'item', item, count, blank? }  2🍎（有 blank：个数要孩子填）
//   { type: 'op', text }                   + − × ÷ = ( )
//   { type: 'num', value, blank? }         一个数（有 blank：要孩子填）
//   { type: 'ref', of, value }             和同一步里那个空是同一个数，孩子填了才显示
// 一行算式：{ kind: 'eq', tag, tokens }
// 竖式：{ kind: 'column', op: '+' | '−', rows: [{ tag, counts, right }], result: { tag, counts, countBlanks, right } }
export const op = (text) => ({ type: 'op', text })
export const num = (value, blank) => (blank ? { type: 'num', value, blank } : { type: 'num', value })
export const ref = (of, value) => ({ type: 'ref', of, value })
export const term = (item, count, blank) => (blank ? { type: 'item', item, count, blank } : { type: 'item', item, count })

// 写完这一步以后，这架天平在后面的步骤里就这样写（去掉空，数都写出来）
export const plain = (tokens) =>
  tokens.map((tok) => {
    if (tok.type === 'ref') return num(tok.value)
    if (!tok.blank) return tok
    return tok.type === 'item' ? term(tok.item, tok.count) : num(tok.value)
  })

export function joinPlus(parts) {
  const out = []
  parts.forEach((part, i) => {
    if (i > 0) out.push(op('+'))
    out.push(...(Array.isArray(part) ? part : [part]))
  })
  return out
}

// 左边：东西按题目里的顺序写，砝码写在后面
export function leftTokens(items, counts, blocks = []) {
  const terms = items.filter((item) => counts[item]).map((item) => term(item, counts[item]))
  return joinPlus([...terms, ...blocks.map((w) => num(w))])
}

export function inParens(tokens) {
  return tokens.some((tok) => tok.type === 'op' && tok.text === '+') ? [op('('), ...tokens, op(')')] : tokens
}

export const eq = (tag, left, right) => ({ kind: 'eq', tag, tokens: [...left, op('='), ...right] })

// 把答案代进一行算式，算出每个等号之间的值（测试用它确认每一行都成立）
export function lineValues(tokens, answer) {
  const parts = [[]]
  for (const tok of tokens) {
    if (tok.type === 'op' && tok.text === '=') parts.push([])
    else parts[parts.length - 1].push(tok)
  }
  return parts.map((part) => {
    let i = 0
    const isOp = (...texts) => i < part.length && part[i].type === 'op' && texts.includes(part[i].text)
    function factor() {
      const tok = part[i++]
      if (tok.type === 'op' && tok.text === '(') {
        const value = sum()
        i++ // ')'
        return value
      }
      return tok.type === 'item' ? tok.count * answer[tok.item] : tok.value
    }
    function product() {
      let value = factor()
      while (isOp('×', '÷')) value = part[i++].text === '×' ? value * factor() : value / factor()
      return value
    }
    function sum() {
      let value = product()
      while (isOp('+', '−')) value = part[i++].text === '+' ? value + product() : value - product()
      return value
    }
    return sum()
  })
}
