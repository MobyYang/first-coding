<script setup>
// 猫头鹰老师：会眨眼、戴眼镜的猫头鹰 + 说话气泡。mood: happy / think / wow / oops
defineProps({
  text: { type: String, default: '' },
  mood: { type: String, default: 'think' },
  size: { type: Number, default: 64 },
})
</script>

<template>
  <div class="owl-says">
    <svg class="owl" :class="`mood-${mood}`" :width="size" :height="size" viewBox="0 0 100 100" aria-hidden="true">
      <g class="owl-body">
        <ellipse cx="50" cy="94" rx="26" ry="4" fill="rgba(29,47,79,0.14)" />
        <path d="M24 34 L 27 14 L 39 29 Z" fill="#7b4d2c" />
        <path d="M76 34 L 73 14 L 61 29 Z" fill="#7b4d2c" />
        <path d="M18 60 Q 10 80 26 90 Q 22 74 26 60 Z" fill="#7b4d2c" />
        <path d="M82 60 Q 90 80 74 90 Q 78 74 74 60 Z" fill="#7b4d2c" />
        <ellipse cx="50" cy="60" rx="33" ry="33" fill="#9c6639" />
        <ellipse cx="50" cy="71" rx="20" ry="19" fill="#f4dcb5" />
        <path d="M41 66 q3 3 6 0 M53 66 q3 3 6 0 M47 75 q3 3 6 0" stroke="#d6b27f" stroke-width="2" fill="none" stroke-linecap="round" />
        <ellipse cx="37" cy="48" rx="14" ry="13" fill="#f9ecd3" />
        <ellipse cx="63" cy="48" rx="14" ry="13" fill="#f9ecd3" />
        <g v-if="mood === 'happy'" class="happy-eyes">
          <path d="M29 50 Q 37 40 45 50" stroke="#1d2f4f" stroke-width="4" fill="none" stroke-linecap="round" />
          <path d="M55 50 Q 63 40 71 50" stroke="#1d2f4f" stroke-width="4" fill="none" stroke-linecap="round" />
        </g>
        <g v-else class="eyes">
          <circle cx="37" cy="48" r="9" fill="#fff" />
          <circle cx="63" cy="48" r="9" fill="#fff" />
          <g class="pupils">
            <circle cx="38" cy="49" :r="mood === 'wow' ? 6.5 : 5" fill="#1d2f4f" />
            <circle cx="62" cy="49" :r="mood === 'wow' ? 6.5 : 5" fill="#1d2f4f" />
            <circle cx="40" cy="46.5" r="1.8" fill="#fff" />
            <circle cx="64" cy="46.5" r="1.8" fill="#fff" />
          </g>
        </g>
        <g class="glasses" fill="none" stroke="#1d2f4f" stroke-width="2.5">
          <circle cx="37" cy="48" r="11.5" />
          <circle cx="63" cy="48" r="11.5" />
          <path d="M48.5 47 Q 50 45 51.5 47" />
        </g>
        <path d="M46 57 L54 57 L50 64 Z" fill="#ff9f1c" />
        <path v-if="mood === 'oops'" d="M79 36 q4 6 0 9 q-4 -3 0 -9 z" fill="#8fd3f4" />
        <path d="M40 92 l-4 4 M44 92 v5 M58 92 l4 4 M56 92 v5" stroke="#ff9f1c" stroke-width="3" stroke-linecap="round" />
      </g>
    </svg>
    <p v-if="text" class="bubble" aria-live="polite">{{ text }}</p>
  </div>
</template>

<style scoped>
.owl-says {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.owl {
  flex: none;
  overflow: visible;
}
.owl-body {
  transform-box: fill-box;
  transform-origin: 50% 100%;
}
.mood-happy .owl-body {
  animation: hop 0.9s ease-in-out 2;
}
.mood-oops .owl-body {
  animation: shake 0.5s ease-in-out 1;
}
.eyes {
  transform-box: fill-box;
  transform-origin: center;
  animation: blink 4.2s infinite;
}
.mood-think .pupils {
  transform: translate(2px, -2px);
}
.mood-oops .pupils {
  transform: translate(-2px, 2px);
}
.bubble {
  position: relative;
  margin: 0;
  padding: 12px 18px;
  background: var(--paper);
  border: 2px solid var(--ink);
  border-radius: 18px;
  font-size: clamp(1.2rem, 2.6vw, 1.4rem);
  line-height: 1.55;
  font-weight: 600;
  color: var(--ink);
  min-width: 0;
  text-wrap: pretty;
}
.bubble::before {
  content: '';
  position: absolute;
  left: -9px;
  top: 50%;
  width: 14px;
  height: 14px;
  background: var(--paper);
  border-left: 2px solid var(--ink);
  border-bottom: 2px solid var(--ink);
  transform: translateY(-50%) rotate(45deg);
}
@keyframes blink {
  0%,
  93%,
  100% {
    transform: scaleY(1);
  }
  96% {
    transform: scaleY(0.1);
  }
}
@keyframes hop {
  0%,
  100% {
    transform: translateY(0);
  }
  40% {
    transform: translateY(-8px) rotate(-3deg);
  }
  70% {
    transform: translateY(0) rotate(2deg);
  }
}
@keyframes shake {
  25% {
    transform: rotate(-6deg);
  }
  75% {
    transform: rotate(6deg);
  }
}
</style>
