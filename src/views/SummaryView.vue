<script setup>
import { computed } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { TEAM_ROSTER, findPlayer } from '../domain/players.js'
import { TEAMS, setsWon } from '../domain/score.js'
import { STAT_LABELS, STAT_TYPES, countersForPlayer, countersForSet } from '../domain/stats.js'
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

const { state, settings } = storeToRefs(matchStore)

const STAT_TYPE_LIST = Object.values(STAT_TYPES)

const teamName = computed(() => settings.value.teamName || 'Мы')
const opponent = computed(() => settings.value.opponent || 'Соперник')
const sets = computed(() => state.value?.score.sets ?? [])
const won = computed(() => (state.value ? setsWon(state.value.score) : { us: 0, them: 0 }))
const stats = computed(() => state.value?.stats ?? { sets: [] })

function counterRows(countersByPlayer) {
  return TEAM_ROSTER.filter((player) => countersByPlayer[player.id]).map((player) => ({
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
  TEAM_ROSTER.map((player) => ({
    player,
    counters: countersForPlayer(stats.value, player.id),
  })),
)

const streakSections = computed(() =>
  sets.value
    .map((set) => ({
      setNumber: set.number,
      text: (state.value?.streaks ?? [])
        .filter((streak) => streak.setNumber === set.number)
        .map(
          (streak) =>
            `${streak.team === TEAMS.US ? teamName.value : opponent.value} +${streak.points}`,
        )
        .join(' · '),
    }))
    .filter((section) => section.text),
)

const retiredPlayers = computed(() =>
  (state.value?.substitutions.retired ?? [])
    .map((playerId) => findPlayer(TEAM_ROSTER, playerId))
    .filter(Boolean),
)

const exceptionalSubstitutions = computed(() =>
  (state.value?.substitutions.exceptional ?? []).map(({ outgoingId, incomingId }) => ({
    outgoing: findPlayer(TEAM_ROSTER, outgoingId),
    incoming: findPlayer(TEAM_ROSTER, incomingId),
  })),
)

function playerName(player) {
  return player ? `${player.firstName} ${player.lastName}` : '—'
}

function printSummary() {
  window.print()
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
      <section class="summary__card" data-field="match-result">
        <h2>{{ teamName }} — {{ opponent }}</h2>
        <p class="summary__score">{{ won.us }}:{{ won.them }}</p>
        <p class="summary__sets">
          <span v-for="set in sets" :key="set.number">
            Партия {{ set.number }}: {{ set.points.us }}:{{ set.points.them }}
          </span>
        </p>
      </section>

      <section
        v-for="section in setSections"
        :key="section.set.number"
        class="summary__card"
        :data-set="section.set.number"
      >
        <h2>
          Партия {{ section.set.number }} · {{ section.set.points.us }}:{{
            section.set.points.them
          }}
        </h2>

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
      </section>

      <section class="summary__card" data-field="total-stats">
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

      <section class="summary__card" data-field="streaks">
        <h2>Серии очков</h2>
        <p v-for="section in streakSections" :key="section.setNumber">
          Партия {{ section.setNumber }}: {{ section.text }}
        </p>
      </section>

      <section
        v-if="retiredPlayers.length || exceptionalSubstitutions.length"
        class="summary__card"
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
        <button type="button" class="no-print" data-action="print" @click="printSummary">
          Печать
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
    </template>

    <p v-else>Матч не найден.</p>
  </section>
</template>

<style scoped>
.summary {
  gap: 16px;
}

.summary__card {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius);
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

.summary__card h2 {
  font-size: 1.05rem;
}

.summary__card h3 {
  margin-top: 4px;
  font-size: 0.95rem;
}

.summary__score {
  color: var(--color-text);
  font-size: 2rem;
  font-weight: 700;
}

.summary__sets {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 16px;
  color: var(--color-muted);
  font-size: 0.9rem;
}

.summary__empty {
  color: var(--color-muted);
  font-size: 0.9rem;
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
  border-bottom: 1px solid #e2e6ec;
  text-align: left;
  white-space: nowrap;
}

.stats-table td,
.stats-table th:not(:first-child) {
  text-align: center;
}

.stats-table thead th {
  color: var(--color-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.summary__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
</style>
