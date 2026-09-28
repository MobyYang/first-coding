<script setup>
// 这一步的天平，就画在这一步里：先是变之前的样子，再变成变之后的样子，两边飘出这一步做的事（比如“− 3”）。
// 例题里这一步一出来就播放；练习时孩子把这一步填对了才播放。点一下天平可以再看一次。
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import BalanceScale from './BalanceScale.vue'
import { t } from '../i18n.js'

const props = defineProps({
  step: { type: Object, required: true },
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  floats: { type: Object, default: () => ({}) },
  play: { type: Boolean, default: true },
})

const changed = ref(false)
const event = ref(null)
let timer = 0

// 合起来的天平是新出来的：变之前先画加起来的那两架，填对了才出现新天平（不然答案就露出来了）
const sources = computed(() => (!changed.value ? props.step.visual.sources : null))
const scale = computed(() => (changed.value ? props.step.visual.after : props.step.visual.before || props.step.visual.after))

function run(delay) {
  clearTimeout(timer)
  changed.value = false
  event.value = null
  timer = setTimeout(() => {
    changed.value = true
    event.value = { kind: props.step.kind, scaleIds: [props.step.visual.after.id], key: Date.now(), ...props.floats }
  }, delay)
}

onMounted(() => {
  if (props.play) run(700)
})
watch(
  () => props.play,
  (now) => {
    if (now) run(150)
  },
)
onBeforeUnmount(() => clearTimeout(timer))

function replay() {
  if (props.play) run(350)
}
</script>

<template>
  <figure class="step-scale">
    <button type="button" class="step-scale-button" :disabled="!play" :aria-label="t('work.replay')" @click="replay">
      <span v-if="sources" class="sources">
        <template v-for="(source, k) in sources" :key="source.id">
          <span v-if="k > 0" class="sources-plus" aria-hidden="true">+</span>
          <span class="source">
            <span class="scale-tag">{{ t('scale.name', { id: source.id }) }}</span>
            <BalanceScale :scale="source" :items="items" :theme="theme" />
          </span>
        </template>
      </span>
      <template v-else>
        <span class="scale-tag">{{ scale.combined ? t('scale.combined', { id: scale.id }) : t('scale.name', { id: scale.id }) }}</span>
        <BalanceScale :scale="scale" :items="items" :theme="theme" :event="event" />
      </template>
    </button>
    <figcaption v-if="play" class="replay">↻ {{ t('work.replay') }}</figcaption>
  </figure>
</template>

<style scoped>
.step-scale {
  margin: 0;
  display: grid;
  gap: 2px;
  justify-items: center;
}
.step-scale-button {
  width: 100%;
  display: grid;
  gap: 2px;
  padding: 6px 8px 8px;
  border: 0;
  border-radius: 18px;
  background: var(--paper);
  box-shadow: 0 2px 0 var(--paper-line);
  font: inherit;
  cursor: pointer;
}
.step-scale-button:disabled {
  cursor: default;
}
.scale-tag {
  justify-self: start;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.9rem;
}
.sources {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: center;
  gap: 4px;
}
.source {
  display: grid;
  gap: 2px;
  min-width: 0;
}
.sources-plus {
  font-size: 1.6rem;
  font-weight: 700;
  color: var(--coral-dark);
}
.replay {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink-soft);
}
</style>
