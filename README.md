# first-coding · 天平学方程

my first coding, hello world!

**天平学方程**是一个给小朋友用的学习网页：用天平一步一步学会**二元一次方程组**。
每架平衡的天平就是一个方程，每种水果就是一个未知数；第 6 课把水果换成 x 和 y，孩子会看到自己一直在解真正的方程组。
默认中文，也可以切换成 English；平板、电脑、手机都能用。

完整的方案见 [docs/proposal.md](docs/proposal.md)。

## 怎么学

一共 7 节课，每节课分两部分：

1. **讲解**：猫头鹰老师把一道例题一步一步演算出来。每一步写成两行：一句短短的“做什么”（比如“两边同时 − 3”）和新的算式（比如“2🍎 = 11 − 3 = 8”）。前面的步骤一直留着，天平也跟着变。
2. **练习**：5 道同类的题，孩子照着例题一步一步演算。每一步的格式已经写好，要算的数空着，孩子点空填数；这一步填对了，天平才变，再写下一步，最后一步算出来的就是答案。
   填错了空会变红，让孩子再算；不会做可以点“提示”（只说这一个空怎么想）或“看例题”。

| 课 | 学什么 | 课本里的名字 |
|---|---|---|
| 1 | 平均分 | 等式两边同除以一个数 |
| 2 | 两边同时拿走 | 等式两边同减一个数 |
| 3 | 先求一个，再代入 | 代入消元法 |
| 4 | 两式相减 | 加减消元法 |
| 5 | 两式相加 | 加减消元法 |
| 6 | 用字母写方程组 | 二元一次方程组 |
| 7 | 买东西 | 应用题 |

## 自己运行

需要先装 [Node.js](https://nodejs.org/)（22 或更新版本）。

```bash
npm install      # 第一次运行前安装依赖
npm run dev      # 本地预览，浏览器打开终端里显示的地址
npm test         # 运行出题、解题、讲解和演算的自动测试
npm run build    # 打包成一个独立的 dist/index.html，双击就能打开
```

## 发布到网上

合并到 `main` 分支后，GitHub Actions 会自动测试、打包并发布到 GitHub Pages
（第一次需要在仓库 **Settings → Pages → Source** 里选 **GitHub Actions**；免费账户要求仓库是公开的）。

## 目录

```
src/
├── core/              纯逻辑，不依赖界面，全部有单元测试
│   ├── scale.js       天平模型：平均分、两边同时拿走、代入、两式相加
│   ├── solver.js      解题程序：按顺序找下一步
│   ├── explain.js     把解题过程变成一步一步
│   ├── working.js     演算过程：每一步“做什么”和新算式，练习时哪些数留空
│   ├── generator.js   出题：先定答案再出题，保证答案是整数
│   ├── lessons.js     7 节课的配置和例题
│   └── random.js      可重复的随机数
├── components/
│   ├── HomeView.vue   课程表
│   ├── LessonView.vue 一节课：讲解 + 5 道练习（孩子一步一步填演算）
│   ├── StepPlayer.vue 讲解：老师一步一步演算例题
│   ├── WorkSheet.vue  演算纸（WorkTokens.vue 画其中的一行）
│   ├── ScaleBoard.vue 天平区（BalanceScale.vue 画一架天平）
│   └── …              数字键盘、猫头鹰老师、成绩、设置等
├── words.js           把演算写成孩子能读懂的话（每步做什么、每个空的提示）
├── items.js           水果、零食和字母
├── i18n.js            中英文文字
├── sound.js           用 Web Audio 合成的音效
└── store.js           学习记录（只存在本机浏览器里）
tests/engine.test.js
```

数字和字母使用的 Fredoka 字体遵循 SIL Open Font License 1.1，见 `src/assets/fredoka-OFL.txt`。
