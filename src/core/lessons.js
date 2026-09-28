// 7 节课，从一个未知数学到二元一次方程组。每节课：先讲一道例题，再练 5 道题。
// 标题、要点等文字在 i18n.js 里（按课的 id）。
// template：练习题用哪种出题模板；tools：讲解时可以用哪些方法；needs：这一课的讲解一定会用到的方法；
// example：讲解用的例题（items 是东西，values 是答案，clues 是每架天平左盘的个数和砝码）
const ALL = ['share', 'takeAway', 'swap', 'combine']
const NO_COMBINE = ['share', 'takeAway', 'swap']

export const LESSONS = [
  {
    id: '1',
    template: 'single-share',
    theme: 'fruit',
    tools: ['share'],
    example: { items: ['apple'], values: [4], clues: [{ counts: [3] }] },
  },
  {
    id: '2',
    template: 'single-mixed',
    theme: 'fruit',
    tools: ['share', 'takeAway'],
    needs: ['takeAway'],
    example: { items: ['apple'], values: [4], clues: [{ counts: [2], blocks: [3] }] },
  },
  {
    id: '3',
    template: 'pair-known',
    theme: 'fruit',
    tools: NO_COMBINE,
    needs: ['swap'],
    example: { items: ['apple', 'banana'], values: [5, 3], clues: [{ counts: [2, 0] }, { counts: [1, 1] }] },
  },
  {
    id: '4',
    template: 'bundle',
    theme: 'fruit',
    tools: NO_COMBINE,
    needs: ['swap'],
    example: { items: ['apple', 'banana'], values: [4, 6], clues: [{ counts: [1, 1] }, { counts: [2, 1] }] },
  },
  {
    id: '5',
    template: 'combine',
    theme: 'fruit',
    tools: ALL,
    needs: ['combine'],
    example: { items: ['apple', 'banana'], values: [4, 5], clues: [{ counts: [2, 1] }, { counts: [1, 2] }] },
  },
  {
    id: '6',
    template: 'mixed',
    theme: 'letters',
    tools: ALL,
    example: { items: ['x', 'y'], values: [4, 6], clues: [{ counts: [1, 1] }, { counts: [2, 1] }] },
  },
  {
    id: '7',
    template: 'mixed-easy',
    theme: 'shop',
    tools: NO_COMBINE,
    example: { items: ['icecream', 'juice'], values: [5, 3], clues: [{ counts: [1, 1] }, { counts: [2, 1] }] },
  },
].map((lesson) => ({ count: 5, ...lesson }))

export function findLesson(id) {
  return LESSONS.find((lesson) => lesson.id === id)
}

// 星星按“第一次就答对”的题数算：全对 3 颗，错 1–2 题 2 颗，其余 1 颗
export function starsFor(firstTry, total) {
  if (firstTry >= total) return 3
  if (firstTry >= total - 2) return 2
  return 1
}
