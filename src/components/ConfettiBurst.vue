<script setup>
// 答对时撒彩带（canvas）。系统设置了“减少动态效果”就不撒。
import { onBeforeUnmount, ref } from 'vue'

const canvas = ref(null)
const COLORS = ['#ff6b4a', '#ffc93c', '#23a05e', '#178f9c', '#e3a526', '#8fd3f4']
let frame = 0

function fire() {
  const el = canvas.value
  if (!el || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
  const ctx = el.getContext('2d')
  const ratio = window.devicePixelRatio || 1
  el.width = window.innerWidth * ratio
  el.height = window.innerHeight * ratio
  ctx.scale(ratio, ratio)
  const w = window.innerWidth
  const h = window.innerHeight
  const bits = Array.from({ length: 140 }, () => ({
    x: w / 2 + (Math.random() - 0.5) * w * 0.3,
    y: h * 0.55,
    vx: (Math.random() - 0.5) * 13,
    vy: -Math.random() * 15 - 6,
    size: 6 + Math.random() * 7,
    spin: Math.random() * Math.PI,
    turn: (Math.random() - 0.5) * 0.3,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
  }))
  const start = performance.now()
  cancelAnimationFrame(frame)
  const step = (now) => {
    ctx.clearRect(0, 0, w, h)
    for (const b of bits) {
      b.vy += 0.42
      b.vx *= 0.99
      b.x += b.vx
      b.y += b.vy
      b.spin += b.turn
      ctx.save()
      ctx.translate(b.x, b.y)
      ctx.rotate(b.spin)
      ctx.fillStyle = b.color
      ctx.fillRect(-b.size / 2, -b.size / 4, b.size, b.size / 2)
      ctx.restore()
    }
    if (now - start < 2600) frame = requestAnimationFrame(step)
    else ctx.clearRect(0, 0, w, h)
  }
  frame = requestAnimationFrame(step)
}

onBeforeUnmount(() => cancelAnimationFrame(frame))
defineExpose({ fire })
</script>

<template>
  <canvas ref="canvas" class="confetti" aria-hidden="true"></canvas>
</template>

<style scoped>
.confetti {
  position: fixed;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
  z-index: 60;
}
</style>
