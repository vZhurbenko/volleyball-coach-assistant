<script setup>
import { computed } from 'vue'

import { TEAMS } from '../domain/score.js'

const props = defineProps({
  set: { type: Object, required: true },
  history: { type: Array, required: true },
  teamName: { type: String, default: 'Мы' },
  opponent: { type: String, default: 'Соперник' },
  /** На отдельном экране ходу партии можно отдать больше высоты. */
  tall: { type: Boolean, default: false },
})

/** Мы всегда в левой колонке и синие, соперник — справа и красный. */
const rows = computed(() => {
  const points = props.history.filter((point) => point.setNumber === props.set.number)
  const score = { us: 0, them: 0 }

  return points.map((point) => {
    score[point.team] += 1

    return {
      first: point.team === TEAMS.US ? score.us : '',
      second: point.team === TEAMS.THEM ? score.them : '',
    }
  })
})
</script>

<template>
  <section class="point-log" :class="{ 'point-log--tall': tall }" data-field="point-log">
    <h3 class="point-log__title">Ход партии</h3>

    <div class="point-log__scroll">
      <table class="point-log__table">
        <thead>
          <tr>
            <th scope="col">{{ teamName }}</th>
            <th scope="col">{{ opponent }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, index) in rows" :key="index" data-point-row>
            <td :class="row.first ? 'point-log__score--us' : ''">{{ row.first }}</td>
            <td :class="row.second ? 'point-log__score--them' : ''">{{ row.second }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.point-log {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.point-log__title {
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.point-log__scroll {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: var(--surface);
}

.point-log--tall .point-log__scroll {
  max-height: none;
  overflow: visible;
}

.point-log__table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
  font-variant-numeric: tabular-nums;
}

.point-log__table th,
.point-log__table td {
  width: 50%;
  padding: 6px 10px;
  border-bottom: 1px solid var(--line);
  text-align: center;
}

.point-log__table thead th {
  position: sticky;
  top: 0;
  background: var(--paper);
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.point-log__table tbody tr:last-child td {
  border-bottom: 0;
}

.point-log__table td {
  font-weight: 700;
}

.point-log__score--us {
  color: var(--us);
}

.point-log__score--them {
  color: var(--them);
}
</style>
