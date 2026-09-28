<script setup>
// 孩子自己列一步：先想这一步做什么，选一个方法；再点天平、写上数，点“写出来”。
// 选的这一步能不能这样做由上一层检查：不能做就在这里说为什么（不替孩子选），能做就写进演算纸。
// 提示也写在这里（先问怎么想，再说用哪个方法），就在孩子正在看的地方。
import { computed } from 'vue'
import BalanceScale from './BalanceScale.vue'
import WorkTokens from './WorkTokens.vue'
import { itemLabel } from '../items.js'
import { t, template } from '../i18n.js'

const props = defineProps({
  stepNo: { type: Number, required: true },
  methods: { type: Array, required: true },
  lines: { type: Array, required: true }, // 每架天平现在的样子：[{ scale, tokens }]
  found: { type: Array, default: () => [] }, // 已经算出来的：[{ item, value, scaleId }]
  choice: { type: Object, required: true }, // { method, scale, other, item, number }
  activeGap: { type: String, default: 'scale' }, // 两架天平的方法：点天平时放进哪个空
  items: { type: Array, required: true },
  theme: { type: String, default: 'fruit' },
  words: { type: Object, required: true },
  message: { type: Object, default: null }, // { text, mood }：提示，或者为什么不能这样做
})
const emit = defineEmits(['method', 'scale', 'gap', 'item', 'number', 'confirm'])

const two = computed(() => ['subtract', 'add'].includes(props.choice.method))
const chosenValue = computed(() => props.found.find((f) => f.item === props.choice.item))
const ready = computed(() => {
  const c = props.choice
  if (c.method === 'share' || c.method === 'takeAway') return Boolean(c.scale && c.number)
  if (c.method === 'substitute') return Boolean(c.item && c.scale)
  if (two.value) return Boolean(c.scale && c.other)
  return false
})

// 这一步写成一句话，{scale}、{number} 这些地方是可以点的空
const sentence = computed(() => {
  if (!props.choice.method) return []
  return template(`compose.${props.choice.method}`)
    .split(/(\{\w+\})/)
    .filter(Boolean)
    .map((part) => {
      const match = part.match(/^\{(\w+)\}$/)
      return match ? { slot: match[1] } : { text: part }
    })
})

const pickLabel = computed(() => {
  if (two.value) return t('compose.pickTwo')
  return props.choice.method === 'substitute' ? t('compose.pickTarget') : t('compose.pickScale')
})
const picked = (id) => props.choice.scale === id || props.choice.other === id
</script>

<template>
  <section class="composer">
    <p class="composer-title">
      <span class="step-no">{{ t('work.stepNo', { n: stepNo }) }}</span>
      <span>{{ t('compose.what') }}</span>
    </p>

    <div class="methods" role="group" :aria-label="t('compose.what')">
      <button
        v-for="method in methods"
        :key="method"
        type="button"
        class="method"
        :class="{ on: choice.method === method }"
        :aria-pressed="choice.method === method"
        @click="emit('method', method)"
      >
        {{ words.methodName(method) }}
      </button>
    </div>

    <template v-if="choice.method">
      <!-- 代入：先选用哪个算出来的数 -->
      <div v-if="choice.method === 'substitute' && found.length" class="found">
        <span class="composer-label">{{ t('compose.whichValue') }}</span>
        <button
          v-for="f in found"
          :key="f.item"
          type="button"
          class="found-chip"
          :class="{ on: choice.item === f.item }"
          @click="emit('item', f.item)"
        >
          {{ itemLabel(f.item) }} = {{ f.value }}
        </button>
      </div>

      <p class="composer-label">{{ pickLabel }}</p>
      <div class="scale-choices" :class="{ single: lines.length === 1 }">
        <button
          v-for="line in lines"
          :key="line.scale.id"
          type="button"
          class="scale-choice"
          :class="{ on: picked(line.scale.id) }"
          :aria-pressed="picked(line.scale.id)"
          @click="emit('scale', line.scale.id)"
        >
          <span class="tag">{{ t('scale.name', { id: line.scale.id }) }}</span>
          <BalanceScale :scale="line.scale" :items="items" :theme="theme" />
          <WorkTokens class="choice-line" :tokens="line.tokens" />
        </button>
      </div>

      <p class="sentence">
        <template v-for="(part, i) in sentence" :key="i">
          <span v-if="part.text">{{ part.text }}</span>
          <button v-else-if="part.slot === 'number'" type="button" class="gap" :class="{ empty: !choice.number }" @click="emit('number')">
            {{ choice.number ?? '?' }}
          </button>
          <span v-else-if="part.slot === 'value'" class="gap" :class="{ empty: !chosenValue }">
            {{ chosenValue ? `${itemLabel(chosenValue.item)} = ${chosenValue.value}` : '?' }}
          </span>
          <button
            v-else-if="two"
            type="button"
            class="gap"
            :class="{ empty: !choice[part.slot], active: activeGap === part.slot }"
            @click="emit('gap', part.slot)"
          >
            {{ choice[part.slot] || '?' }}
          </button>
          <span v-else class="gap" :class="{ empty: !choice[part.slot] }">{{ choice[part.slot] || '?' }}</span>
        </template>
      </p>
    </template>

    <p v-if="message" class="composer-message" :class="`mood-${message.mood}`">🦉 {{ message.text }}</p>

    <div v-if="choice.method" class="composer-actions">
      <button type="button" class="btn btn-primary" :disabled="!ready" @click="emit('confirm')">✓ {{ t('compose.write') }}</button>
    </div>
  </section>
</template>

<style scoped>
.composer {
  display: grid;
  gap: 10px;
  padding: 10px 12px 12px;
  border-radius: 16px;
  border: 3px solid var(--sun);
  background: #fff8dc;
  scroll-margin: 90px 0 110px;
}
.composer-title {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  font-size: clamp(1.1rem, 2.6vw, 1.3rem);
  font-weight: 700;
  color: var(--teal);
}
.step-no {
  padding: 2px 10px;
  border-radius: 999px;
  background: var(--teal);
  color: #fff;
  font-size: 0.85em;
}
.methods {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.method {
  min-height: 48px;
  padding: 6px 16px;
  border: 3px solid var(--teal);
  border-radius: 14px;
  background: #fff;
  color: var(--teal);
  font: inherit;
  font-size: 1.15rem;
  font-weight: 700;
  cursor: pointer;
}
.method.on {
  background: var(--teal);
  color: #fff;
}
.composer-label {
  margin: 0;
  font-weight: 700;
  color: var(--ink-soft);
}
.found {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.found-chip {
  min-height: 44px;
  padding: 4px 14px;
  border: 3px solid var(--leaf);
  border-radius: 12px;
  background: #fff;
  color: var(--leaf);
  font: inherit;
  font-size: 1.25rem;
  font-weight: 700;
  cursor: pointer;
}
.found-chip.on {
  background: var(--leaf);
  color: #fff;
}
.scale-choices {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 10px;
  max-width: 500px; /* 手机上一排两架，宽屏上也不会太大 */
}
.scale-choices.single {
  max-width: 250px;
}
.scale-choice {
  display: grid;
  gap: 2px;
  padding: 6px 8px 8px;
  border: 3px solid transparent;
  border-radius: 16px;
  background: #fff;
  box-shadow: 0 2px 0 var(--paper-line);
  font: inherit;
  cursor: pointer;
}
.scale-choice.on {
  border-color: var(--coral);
  box-shadow: 0 0 0 3px rgba(255, 107, 74, 0.2);
}
.tag {
  justify-self: start;
  padding: 2px 10px;
  border-radius: 10px;
  background: var(--brass-light);
  color: #6b4a06;
  font-weight: 700;
  font-size: 0.9rem;
}
.choice-line {
  justify-content: center;
  font-size: 1.15rem;
  font-weight: 600;
}
.sentence {
  margin: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  font-size: clamp(1.3rem, 3vw, 1.6rem);
  font-weight: 700;
}
.gap {
  display: inline-grid;
  place-items: center;
  min-width: 2.2em;
  min-height: 1.7em;
  padding: 0 8px;
  border: 3px solid var(--coral);
  border-radius: 12px;
  background: #fff;
  color: var(--coral-dark);
  font: inherit;
  font-weight: 700;
  line-height: 1;
}
button.gap {
  cursor: pointer;
}
.gap.empty {
  border-style: dashed;
  color: var(--ink-soft);
}
.gap.active {
  box-shadow: 0 0 0 4px rgba(255, 201, 60, 0.6);
}
.composer-message {
  margin: 0;
  padding: 10px 12px;
  border-radius: 12px;
  background: #fff;
  font-size: clamp(1.05rem, 2.4vw, 1.2rem);
  font-weight: 700;
  line-height: 1.5;
  color: var(--teal);
  scroll-margin: 90px 0 110px;
}
.composer-message.mood-oops {
  color: var(--berry);
}
.composer-message.mood-happy {
  color: var(--leaf);
}
.composer-actions {
  display: flex;
  justify-content: flex-end;
  scroll-margin: 90px 0 110px; /* 滚过来时别被底下的按钮挡住 */
}
</style>
