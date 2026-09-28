import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { viteSingleFile } from 'vite-plugin-singlefile'

// 打包成一个独立的 dist/index.html：双击就能玩，也能直接放到任何静态网站上
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  test: {
    include: ['tests/**/*.test.js'],
  },
})
