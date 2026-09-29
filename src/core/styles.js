// 两种写法：列算式（practice.js、working.js），看图算（look.js，第 4 课先试用）。
// 课程里写 style: 'look' 就用看图算；界面和老师讲解都从这里拿，不用管是哪一种。
import { buildLookWorking, lookFound, lookHint, lookLines, lookSheet, lookSolved, planLook, startLook } from './look.js'
import { currentLines, foundList, nextStepHint, planStep, practiceSolved, problemSheet, startPractice } from './practice.js'
import { buildWorking } from './working.js'

const WRITE = { start: startPractice, solved: practiceSolved, sheet: problemSheet, lines: currentLines, found: foundList, plan: planStep, hint: nextStepHint }
const LOOK = { start: startLook, solved: lookSolved, sheet: lookSheet, lines: lookLines, found: lookFound, plan: planLook, hint: lookHint }

export const engineFor = (lesson) => (lesson.style === 'look' ? LOOK : WRITE)

export function exampleWorking(lesson, puzzle) {
  return lesson.style === 'look' ? buildLookWorking(puzzle) : buildWorking(puzzle, lesson.tools)
}
