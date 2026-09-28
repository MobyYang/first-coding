// 可以设“种子”的随机数：同一个种子永远出同一套题，方便复现和测试（mulberry32 算法）
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0

  function next() {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    // min 到 max 之间的整数（包含两端）
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (list) => list[Math.floor(next() * list.length)],
    shuffle(list) {
      const out = [...list]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j], out[i]]
      }
      return out
    },
  }
}

export function randomSeed() {
  return Math.floor(Math.random() * 2 ** 31)
}
