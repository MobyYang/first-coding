<script setup>
// 天平区：每架天平一张卡片，下面写着它现在的算式。演算写到哪一步，天平就变到哪一步。
import BalanceScale from './BalanceScale.vue'
import EquationLine from './EquationLine.vue'
import { t } from '../i18n.js'

defineProps({
  board: { type: Object, required: true },
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  event: { type: Object, default: null },
  active: { type: Array, default: () => [] },
  keyPrefix: { type: String, default: '' },
})
</script>

<template>
  <TransitionGroup tag="div" name="card" appear class="scales" :class="`count-${board.scales.length}`">
    <article
      v-for="scale in board.scales"
      :key="`${keyPrefix}-${scale.id}`"
      class="scale-card"
      :class="{ active: active.includes(scale.id) }"
    >
      <span class="scale-tag">{{ scale.combined ? t('scale.combined', { id: scale.id }) : t('scale.name', { id: scale.id }) }}</span>
      <BalanceScale :scale="scale" :items="items" :theme="theme" :event="event" />
      <EquationLine :scale="scale" :items="items" :theme="theme" />
    </article>
  </TransitionGroup>
</template>

<style scoped>
.scales {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 160px), 1fr));
  gap: 12px;
  align-items: start;
}
.scales.count-1 {
  grid-template-columns: 1fr;
  max-width: 460px;
  width: 100%;
  margin-inline: auto;
}
@media (min-width: 900px) {
  .scales {
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  }
}
.scale-card {
  display: grid;
  gap: 4px;
  padding: 8px 10px 10px;
  border-radius: var(--radius);
  background: var(--paper);
  border: 3px solid transparent;
  box-shadow: var(--shadow);
  transition: border-color 0.2s;
}
.scale-card.active {
  border-color: var(--sun);
}
.scale-tag {
  justify-self: start;
  padding: 3px 12px;
  border-radius: 10px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.95rem;
}
.card-enter-active {
  animation: card-pop 0.4s cubic-bezier(0.3, 1.4, 0.5, 1);
}
.card-leave-active {
  animation: card-pop 0.25s ease-in reverse;
}
@keyframes card-pop {
  from {
    transform: scale(0.85);
    opacity: 0;
  }
}
</style>
