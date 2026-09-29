<script setup>
// 竖式：两个算式上下对齐，🍎 对着 🍎、🍌 对着 🍌，左边加（减）左边，右边加（减）右边。
// 相减时，上下一样多的东西划一道线，孩子能看到它们减掉了。
import { computed } from 'vue'
import WorkTokens from './WorkTokens.vue'

const props = defineProps({
  line: { type: Object, required: true },
  items: { type: Array, required: true },
  mode: { type: String, default: 'show' },
  values: { type: Object, default: () => ({}) },
  wrong: { type: Object, default: () => ({}) },
  active: { type: String, default: null },
  next: { type: String, default: null },
})
const emit = defineEmits(['pick'])

const rows = computed(() => [...props.line.rows, props.line.result])
const cols = computed(() => props.items.filter((item) => rows.value.some((row) => row.counts[item])))
const cancelled = computed(() => {
  if (props.line.op !== '−') return new Set()
  const [top, bottom] = props.line.rows
  return new Set(cols.value.filter((item) => top.counts[item] && top.counts[item] === bottom.counts[item]))
})
const blankProps = computed(() => ({ mode: props.mode, values: props.values, wrong: props.wrong, active: props.active, next: props.next }))

function termTokens(row, item) {
  const blank = row.countBlanks?.[item]
  return [blank ? { type: 'item', item, count: row.counts[item], blank } : { type: 'item', item, count: row.counts[item] }]
}
const plus = (row, k) => k > 0 && row.counts[cols.value[k - 1]] && row.counts[cols.value[k]]
</script>

<template>
  <table class="column-block">
    <tbody>
      <tr v-for="(row, r) in rows" :key="r" :class="{ result: r === rows.length - 1 }">
        <td class="sign">{{ r === 1 ? line.op : '' }}</td>
        <td class="tag-cell"><span class="tag">{{ row.tag }}</span></td>
        <template v-for="(item, k) in cols" :key="item">
          <td v-if="k > 0" class="plus">{{ plus(row, k) ? '+' : '' }}</td>
          <td class="term" :class="{ cancel: r < 2 && cancelled.has(item) }">
            <WorkTokens
              v-if="row.counts[item]"
              :tokens="termTokens(row, item)"
              v-bind="r === rows.length - 1 ? blankProps : {}"
              @pick="emit('pick', $event)"
            />
          </td>
        </template>
        <td class="eq">=</td>
        <td class="right">
          <WorkTokens v-if="r === rows.length - 1" :tokens="[row.right]" v-bind="blankProps" @pick="emit('pick', $event)" />
          <span v-else class="right-num">{{ row.right }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<style scoped>
.column-block {
  justify-self: start;
  border-collapse: collapse;
  font-size: clamp(1.05rem, 3vw, 1.55rem);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}
td {
  padding: 3px 3px;
  text-align: center;
  white-space: nowrap;
}
.sign {
  width: 1.2em;
  font-weight: 700;
  color: var(--coral-dark);
  font-size: 1.2em;
}
.tag-cell {
  padding-right: 8px;
}
.tag {
  display: inline-grid;
  place-items: center;
  min-width: 1.9rem;
  padding: 2px 6px;
  border-radius: 8px;
  background: var(--brass-light);
  color: #6b4a06;
  font-size: 0.95rem;
  font-weight: 700;
}
.plus,
.eq {
  color: var(--ink-soft);
}
.right {
  text-align: left;
}
.right-num {
  font-weight: 700;
}
.term.cancel {
  position: relative;
  opacity: 0.55;
}
.term.cancel::after {
  content: '';
  position: absolute;
  left: 8%;
  right: 8%;
  top: 50%;
  border-top: 3px solid var(--berry);
  transform: rotate(-12deg);
}
tr.result td {
  border-top: 3px solid var(--ink);
  padding-top: 7px;
}
tr.result .sign,
tr.result .tag-cell {
  border-top-color: transparent;
}
</style>
