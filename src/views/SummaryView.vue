<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import SetPointLog from '../components/SetPointLog.vue'
import { substitutionsBySet } from '../domain/match.js'
import { findPlayer } from '../domain/players.js'
import { TEAMS, setWinner, setsWon } from '../domain/score.js'
import {
  STAT_LABELS,
  STAT_TYPES,
  countersForPlayer,
  countersForSet,
  errorsTotal,
  pointsTotal,
} from '../domain/stats.js'
import { buildPdfFilename, generateSummaryPdf, savePdf } from '../pdf.js'
import { useLineupStore } from '../stores/lineup.js'
import { useMatchStore } from '../stores/match.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const router = useRouter()
const matchStore = useMatchStore()
matchStore.load(props.storage)
const lineupStore = useLineupStore()
lineupStore.load(props.storage)

const { events, state, settings } = storeToRefs(matchStore)
const { roster } = storeToRefs(lineupStore)

const STAT_TYPE_LIST = Object.values(STAT_TYPES)

const exportStatus = ref('')
const isGenerating = ref(false)
const summaryElement = ref(null)

const teamName = computed(() => settings.value.teamName || 'Мы')
const opponent = computed(() => settings.value.opponent || 'Соперник')
const sets = computed(() => state.value?.score.sets ?? [])
const won = computed(() => (state.value ? setsWon(state.value.score) : { us: 0, them: 0 }))
const stats = computed(() => state.value?.stats ?? { sets: [] })

function counterRows(countersByPlayer) {
  return roster.value
    .filter((player) => countersByPlayer[player.id])
    .map((player) => ({
      player,
      counters: countersByPlayer[player.id],
    }))
}

const substitutionLog = computed(() => substitutionsBySet(events.value))

const setSections = computed(() =>
  sets.value.map((set) => ({
    set,
    rows: counterRows(countersForSet(stats.value, set.number)),
    substitutions: substitutionLog.value[set.number - 1] ?? [],
  })),
)

const totalRows = computed(() =>
  roster.value.map((player) => ({
    player,
    counters: countersForPlayer(stats.value, player.id),
  })),
)

function playerName(player) {
  return player ? `${player.firstName} ${player.lastName}` : '—'
}

async function downloadPdf() {
  if (isGenerating.value) return

  isGenerating.value = true
  exportStatus.value = ''

  try {
    const filename = buildPdfFilename()
    const blob = await generateSummaryPdf(summaryElement.value, { filename, singlePage: true })
    await savePdf(blob, filename)
  } catch (error) {
    if (error?.name !== 'AbortError') exportStatus.value = 'Не удалось создать PDF'
  } finally {
    isGenerating.value = false
  }
}

function newGame() {
  matchStore.reset()
  lineupStore.reset()
  router.push({ name: 'lineup' })
}
</script>

<template>
  <section ref="summaryElement" class="screen summary" data-field="pdf-summary">
    <h1>Итоги матча</h1>

    <template v-if="state">
      <section class="summary__hero board" data-field="match-result">
        <p class="summary__teams">
          <span class="summary__team--us">{{ teamName }}</span>
          <span class="summary__vs">—</span>
          <span class="summary__team--them">{{ opponent }}</span>
        </p>
        <p class="summary__score">
          <span class="summary__score--us">{{ won.us }}</span
          ><span class="summary__score-sep">:</span
          ><span class="summary__score--them">{{ won.them }}</span>
        </p>
        <ol class="set-chips">
          <li
            v-for="set in sets"
            :key="set.number"
            class="set-chip"
            :class="setWinner(set) === TEAMS.US ? 'set-chip--us' : 'set-chip--them'"
          >
            <span class="set-chip__number">Партия {{ set.number }}</span>
            <span class="set-chip__score">{{ set.points.us }}:{{ set.points.them }}</span>
          </li>
        </ol>
      </section>

      <div class="summary__actions no-print" data-field="summary-actions">
        <button
          type="button"
          class="no-print"
          data-action="pdf"
          :disabled="isGenerating"
          @click="downloadPdf"
        >
          {{ isGenerating ? 'Генерация…' : 'Скачать PDF' }}
        </button>
      </div>

      <p
        v-if="exportStatus"
        class="summary__status no-print"
        role="status"
        data-field="export-status"
      >
        {{ exportStatus }}
      </p>

      <section
        v-for="section in setSections"
        :key="section.set.number"
        class="summary__card board"
        :data-set="section.set.number"
      >
        <div class="summary__set-head">
          <h2>Партия {{ section.set.number }}</h2>
          <span class="summary__set-score">
            {{ section.set.points.us }}:{{ section.set.points.them }}
          </span>
        </div>

        <div v-if="section.rows.length" class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th scope="col">Игрок</th>
                <th v-for="type in STAT_TYPE_LIST" :key="type" scope="col">
                  {{ STAT_LABELS[type] }}
                </th>
                <th scope="col">Итого ошибок</th>
                <th scope="col">Итого очков</th>
              </tr>
            </thead>
            <tbody>
              <tr
                v-for="row in section.rows"
                :key="row.player.id"
                :data-stat-player="row.player.id"
              >
                <th scope="row">{{ row.player.number }} · {{ row.player.lastName }}</th>
                <td v-for="type in STAT_TYPE_LIST" :key="type" :data-stat="type">
                  {{ row.counters[type] ?? 0 }}
                </td>
                <td data-stat-total="errors">{{ errorsTotal(row.counters) }}</td>
                <td data-stat-total="points">{{ pointsTotal(row.counters) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="summary__empty">Статистика не велась</p>

        <SetPointLog
          :set="section.set"
          :history="state.history"
          :team-name="teamName"
          :opponent="opponent"
        />

        <div
          v-if="section.substitutions.length"
          class="summary__subs"
          data-field="set-substitutions"
        >
          <h3>Замены в партии</h3>
          <ul>
            <li v-for="(sub, index) in section.substitutions" :key="index">
              {{ playerName(findPlayer(roster, sub.outgoingId)) }} →
              {{ playerName(findPlayer(roster, sub.incomingId)) }}
              <span v-if="sub.exceptional" class="summary__subs-note">(исключительная)</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="summary__card board" data-field="total-stats">
        <h2>За матч</h2>
        <div v-if="totalRows.length" class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th scope="col">Игрок</th>
                <th v-for="type in STAT_TYPE_LIST" :key="type" scope="col">
                  {{ STAT_LABELS[type] }}
                </th>
                <th scope="col">Итого ошибок</th>
                <th scope="col">Итого очков</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in totalRows" :key="row.player.id" :data-total-player="row.player.id">
                <th scope="row">{{ row.player.number }} · {{ row.player.lastName }}</th>
                <td v-for="type in STAT_TYPE_LIST" :key="type" :data-stat="type">
                  {{ row.counters[type] ?? 0 }}
                </td>
                <td data-stat-total="errors">{{ errorsTotal(row.counters) }}</td>
                <td data-stat-total="points">{{ pointsTotal(row.counters) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p v-else class="summary__empty">Статистика не велась</p>
      </section>

      <div class="summary__finish no-print">
        <button
          type="button"
          class="button-secondary no-print"
          data-action="new-game"
          @click="newGame"
        >
          Новая игра
        </button>
      </div>
    </template>

    <p v-else>Матч не найден.</p>
  </section>
</template>

<style scoped>
.summary {
  gap: 16px;
}

.summary__hero {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 16px;
}

.summary__teams {
  display: flex;
  align-items: baseline;
  gap: 8px;
  color: var(--ink-soft);
  font-size: 0.85rem;
  font-weight: 650;
}

.summary__team--us {
  color: var(--us-deep);
}

.summary__team--them {
  color: var(--them-deep);
}

.summary__vs {
  color: var(--line-strong);
  font-weight: 500;
}

.summary__score {
  display: flex;
  align-items: baseline;
  gap: 2px;
  color: var(--ink);
  font-size: 2.6rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1;
}

.summary__score--us {
  color: var(--us);
}

.summary__score--them {
  color: var(--them);
}

.summary__score-sep {
  color: var(--ink-soft);
  font-weight: 500;
}

.set-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0;
  list-style: none;
}

.set-chip {
  display: flex;
  flex-direction: column;
  gap: 1px;
  min-width: 72px;
  padding: 6px 8px;
  border: 1px solid var(--line);
  border-left: 3px solid var(--line-strong);
  border-radius: 8px;
  background: var(--surface);
}

.set-chip--us {
  border-left-color: var(--us);
}

.set-chip--them {
  border-left-color: var(--them);
}

.set-chip__number {
  color: var(--ink-soft);
  font-size: 0.68rem;
  font-weight: 650;
}

.set-chip__score {
  color: var(--ink);
  font-size: 0.95rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.summary__card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.summary__card h2 {
  font-size: 1.05rem;
}

.summary__card h3 {
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.summary__set-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.summary__set-score {
  color: var(--ink);
  font-size: 1rem;
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.summary__empty {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.summary__subs {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.summary__subs-note {
  color: var(--ink-soft);
  font-size: 0.8rem;
}

.table-wrap {
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
}

.stats-table th,
.stats-table td {
  padding: 6px;
  border-bottom: 1px solid var(--line);
  text-align: left;
}

.stats-table th:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  width: 22%;
  background: var(--surface);
  box-shadow: 1px 0 0 var(--line);
}

.stats-table thead th:first-child {
  z-index: 2;
}

.stats-table th:not(:first-child) {
  width: 9.75%;
}

.stats-table td,
.stats-table th:not(:first-child) {
  text-align: center;
}

.stats-table thead th {
  color: var(--ink-soft);
  font-size: 0.72rem;
  font-weight: 650;
  letter-spacing: 0.01em;
  white-space: normal;
}

.stats-table tbody th {
  font-weight: 650;
  white-space: normal;
}

.stats-table td {
  white-space: nowrap;
}

.stats-table tbody tr:last-child td,
.stats-table tbody tr:last-child th {
  border-bottom: 0;
}

.stats-table th:nth-last-child(2),
.stats-table td:nth-last-child(2) {
  border-left: 1px solid var(--line);
}

.stats-table [data-stat-total] {
  background: var(--paper);
  font-weight: 750;
}

.summary__card ul {
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.6;
}

.summary__actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.summary__actions > button {
  flex: 1 1 140px;
}

.summary__finish button {
  width: 100%;
}

.summary__status {
  color: var(--ink-soft);
  font-size: 0.85rem;
  text-align: center;
}
</style>
