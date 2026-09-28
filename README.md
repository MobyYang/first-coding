# first-coding · 方程小侦探

my first coding, hello world!

**方程小侦探**是一个给小朋友玩的网页小游戏：用天平和水果谜题，一步步学会**二元一次方程组**。
每架平衡的天平就是一个方程，每种水果就是一个未知数；到最后一章，水果换成 x 和 y，孩子会发现自己一直在解真正的方程组。
支持中文 / English，平板、电脑、手机都能玩。

完整的设计方案见 [docs/proposal.md](docs/proposal.md)。

## 怎么玩

| 侦探道具 | 做什么 | 对应课本里的方法 |
|---|---|---|
| ✂️ 分一分 | 两边同时平均分 | 等式两边同除以一个数 |
| ✋ 拿走 | 两边同时拿走一样重的砝码 | 等式两边同减一个数 |
| 🔄 换一换 | 用一样重的东西替换 | 代入消元 |
| ➕ 合一合 | 两架天平合成一架 | 加减消元 |

也可以直接在“侦探笔记”里猜数字，再点“称一称”：猜错了天平会往重的一边歪。

## 自己运行

需要先装 [Node.js](https://nodejs.org/)（22 或更新版本）。

```bash
npm install      # 第一次运行前安装依赖
npm run dev      # 本地预览，浏览器打开终端里显示的地址
npm test         # 运行出题器和解题逻辑的自动测试
npm run build    # 打包成一个独立的 dist/index.html，双击就能玩
```

## 发布到网上

合并到 `main` 分支后，GitHub Actions 会自动测试、打包并发布到 GitHub Pages
（第一次需要在仓库 **Settings → Pages → Source** 里选 **GitHub Actions**；免费账户要求仓库是公开的）。

## 目录

```
src/
├── core/            纯逻辑，不依赖界面，全部有单元测试
│   ├── scale.js     天平模型和四个侦探道具
│   ├── solver.js    解题思路（提示功能用它找下一步）
│   ├── generator.js 出题器：先定答案再出题，保证答案是整数
│   ├── cage.js      鸡兔同笼
│   └── levels.js    关卡配置
├── components/      天平、关卡、地图、贴纸本、设置等界面
├── i18n.js          中英文文字
├── sound.js         用 Web Audio 合成的音效
└── store.js         学习进度（只存在本机浏览器里）
tests/engine.test.js
```

数字和字母使用的 Fredoka 字体遵循 SIL Open Font License 1.1，见 `src/assets/fredoka-OFL.txt`。
