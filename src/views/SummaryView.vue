<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import SetPointLog from '../components/SetPointLog.vue'
import { findPlayer } from '../domain/players.js'
import { TEAMS, setWinner, setsWon } from '../domain/score.js'
import { STAT_LABELS, STAT_TYPES, countersForPlayer, countersForSet } from '../domain/stats.js'
import { buildSummaryText } from '../domain/summary.js'
import { isIosStandalone } from '../platform.js'
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

const { state, settings } = storeToRefs(matchStore)
const { roster } = storeToRefs(lineupStore)

const STAT_TYPE_LIST = Object.values(STAT_TYPES)

const standalone = isIosStandalone()
const canShare = typeof navigator.share === 'function'
const exportStatus = ref('')

const teamName = computed(() => settings.value.teamName || 'Мы')
const opponent = computed(() => settings.value.opponent || 'Соперник')
const sets = computed(() => state.value?.score.sets ?? [])
const won = computed(() => (state.value ? setsWon(state.value.score) : { us: 0, them: 0 }))
const stats = computed(() => state.value?.stats ?? { sets: [] })

function counterRows(countersByPlayer) {
  return roster.value.filter((player) => countersByPlayer[player.id]).map((player) => ({
    player,
    counters: countersByPlayer[player.id],
  }))
}

const setSections = computed(() =>
  sets.value.map((set) => ({
    set,
    rows: counterRows(countersForSet(stats.value, set.number)),
  })),
)

const totalRows = computed(() =>
  roster.value.map((player) => ({
    player,
    counters: countersForPlayer(stats.value, player.id),
  })),
)

const retiredPlayers = computed(() =>
  (state.value?.substitutions.retired ?? [])
    .map((playerId) => findPlayer(roster.value, playerId))
    .filter(Boolean),
)

const exceptionalSubstitutions = computed(() =>
  (state.value?.substitutions.exceptional ?? []).map(({ outgoingId, incomingId }) => ({
    outgoing: findPlayer(roster.value, outgoingId),
    incoming: findPlayer(roster.value, incomingId),
  })),
)

const summaryText = computed(() =>
  state.value
    ? buildSummaryText({ state: state.value, settings: settings.value, roster: roster.value })
    : '',
)

function playerName(player) {
  return player ? `${player.firstName} ${player.lastName}` : '—'
}

function printSummary() {
  window.print()
}

async function shareSummary() {
  try {
    await navigator.share({ title: 'Итоги матча', text: summaryText.value })
    exportStatus.value = ''
  } catch (error) {
    if (error?.name !== 'AbortError') exportStatus.value = 'Не удалось поделиться'
  }
}

async function copySummary() {
  try {
    await navigator.clipboard.writeText(summaryText.value)
    exportStatus.value = 'Скопировано'
  } catch {
    exportStatus.value = 'Не удалось скопировать'
  }
}

function newGame() {
  matchStore.reset()
  lineupStore.reset()
  router.push({ name: 'lineup' })
}
</script>

<template>
  <section class="screen summary">
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
                  {{ row.counters[type] }}
                </td>
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
      </section>

      <section class="summary__card board" data-field="total-stats">
        <h2>За матч</h2>
        <div class="table-wrap">
          <table class="stats-table">
            <thead>
              <tr>
                <th scope="col">Игрок</th>
                <th v-for="type in STAT_TYPE_LIST" :key="type" scope="col">
                  {{ STAT_LABELS[type] }}
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="row in totalRows" :key="row.player.id" :data-total-player="row.player.id">
                <th scope="row">{{ row.player.number }} · {{ row.player.lastName }}</th>
                <td v-for="type in STAT_TYPE_LIST" :key="type" :data-stat="type">
                  {{ row.counters[type] }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section
        v-if="retiredPlayers.length || exceptionalSubstitutions.length"
        class="summary__card board"
        data-field="substitutions"
      >
        <h2>Замены</h2>

        <div v-if="exceptionalSubstitutions.length" data-field="exceptional-substitutions">
          <h3>Исключительные</h3>
          <ul>
            <li v-for="(sub, index) in exceptionalSubstitutions" :key="index">
              {{ playerName(sub.outgoing) }} → {{ playerName(sub.incoming) }} (выбыл:
              {{ playerName(sub.outgoing) }})
            </li>
          </ul>
        </div>

        <div v-if="retiredPlayers.length" data-field="retired">
          <h3>Выбывшие</h3>
          <ul>
            <li v-for="player in retiredPlayers" :key="player.id">{{ playerName(player) }}</li>
          </ul>
        </div>
      </section>

      <div class="summary__actions no-print">
        <button
          v-if="!standalone"
          type="button"
          class="no-print"
          data-action="print"
          @click="printSummary"
        >
          Печать
        </button>
        <button
          v-if="canShare"
          type="button"
          class="no-print"
          data-action="share"
          @click="shareSummary"
        >
          Поделиться
        </button>
        <button type="button" class="no-print" data-action="copy" @click="copySummary">
          Скопировать
        </button>
        <button
          type="button"
          class="button-secondary no-print"
          data-action="new-game"
          @click="newGame"
        >
          Новая игра
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

.table-wrap {
  overflow-x: auto;
}

.stats-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.stats-table th,
.stats-table td {
  padding: 6px 8px;
  border-bottom: 1px solid var(--line);
  text-align: left;
  white-space: nowrap;
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
}

.stats-table tbody th {
  font-weight: 650;
}

.stats-table tbody tr:last-child td,
.stats-table tbody tr:last-child th {
  border-bottom: 0;
}

.summary__card ul {
  padding-left: 18px;
  color: var(--ink-soft);
  font-size: 0.9rem;
  line-height: 1.6;
}

.summary__actions {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 8px;
}

.summary__status {
  color: var(--ink-soft);
  font-size: 0.85rem;
  text-align: center;
}
</style>
