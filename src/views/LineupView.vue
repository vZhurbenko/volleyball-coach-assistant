<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import LineupCourt from '../components/LineupCourt.vue'
import LineupPlayerDialog from '../components/LineupPlayerDialog.vue'
import { ROLES } from '../domain/constants.js'
import { availablePlayersForZone } from '../domain/lineup.js'
import { findPlayer } from '../domain/players.js'
import { TEAMS, currentSet, isMatchOver, isSetOver } from '../domain/score.js'
import { useLineupStore } from '../stores/lineup.js'
import { useMatchStore } from '../stores/match.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const lineupStore = useLineupStore()
lineupStore.load(props.storage)
const { roster, lineup, validation } = storeToRefs(lineupStore)

const matchStore = useMatchStore()
matchStore.load(props.storage)
const { state, settings, currentSetServing } = storeToRefs(matchStore)

const router = useRouter()

const valid = computed(() => validation.value.valid)
const violations = computed(() => validation.value.violations)
const liberoPlayers = computed(() => roster.value.filter((player) => player.role === ROLES.LIBERO))
const liberoName = computed(() => {
  const player = findPlayer(roster.value, lineup.value.liberoId)
  return player ? `${player.firstName} ${player.lastName}` : null
})

const betweenSets = computed(() => {
  if (!state.value) return false

  return isSetOver(currentSet(state.value.score)) && !isMatchOver(state.value.score)
})

const nextSetNumber = computed(() => (state.value?.setNumber ?? 0) + 1)
const isFifthSet = computed(() => nextSetNumber.value === 5)
const tiebreakServing = ref(null)

const opponentLabel = computed(() => settings.value.opponent || 'Соперник')
const automaticServing = computed(() =>
  currentSetServing.value === TEAMS.US ? TEAMS.THEM : TEAMS.US,
)
const nextServingLabel = computed(() =>
  automaticServing.value === TEAMS.US ? 'Мы' : opponentLabel.value,
)

// Между партиями шестёрка прошлой партии уже стоит на площадке — её можно менять.
if (betweenSets.value) lineupStore.setLineup(state.value.lineup)

const pickingZone = ref(null)

const dialogPlayers = computed(() =>
  pickingZone.value === null
    ? roster.value
    : availablePlayersForZone(lineup.value, roster.value, pickingZone.value),
)

function assign({ playerId, role }) {
  lineupStore.assign(pickingZone.value, { playerId, role })
  pickingZone.value = null
}

function setLibero(event) {
  lineupStore.setLibero(event.target.value || null)
}

function goNext() {
  if (!valid.value) return
  router.push({ name: 'setup' })
}

function startNextSet() {
  if (!valid.value) return

  const serving = isFifthSet.value ? tiebreakServing.value : automaticServing.value
  if (!serving) return

  if (!matchStore.startNextSet({ lineup: lineup.value, serving }).ok) return
  router.push({ name: 'match' })
}
</script>

<template>
  <section class="screen">
    <div class="screen__head">
      <h1>Расстановка</h1>
      <button
        v-if="!state"
        type="button"
        class="button-secondary"
        data-action="edit-roster"
        @click="router.push({ name: 'roster' })"
      >
        Настроить состав
      </button>
    </div>
    <p>Нажмите на зону и выберите игрока. Роль можно переопределить при назначении.</p>

    <LineupCourt :lineup="lineup" :roster="roster" @select="pickingZone = $event" />

    <ul v-if="!valid" class="violations" role="alert">
      <li v-for="violation in violations" :key="`${violation.code}-${violation.zone ?? ''}`">
        {{ violation.message }}
      </li>
    </ul>

    <div class="libero">
      <label class="libero__label" for="lineup-libero">Либеро (необязательно)</label>
      <select
        id="lineup-libero"
        data-field="libero"
        :value="lineup.liberoId ?? ''"
        @change="setLibero"
      >
        <option value="">Без либеро</option>
        <option v-for="player in liberoPlayers" :key="player.id" :value="player.id">
          {{ player.number }} · {{ player.firstName }} {{ player.lastName }}
        </option>
      </select>
      <p class="libero__status">
        {{ liberoName ? `Либеро: ${liberoName}` : 'Либеро не выбран' }}
      </p>
    </div>

    <template v-if="betweenSets">
      <section class="set-break board" data-field="set-break">
        <p class="set-break__title">Партия {{ state.setNumber }} завершена</p>

        <template v-if="isFifthSet">
          <fieldset class="field">
            <legend class="field__label">Кто подаёт первым в 5-й партии</legend>
            <div class="segmented">
              <label class="segmented__option">
                <input
                  v-model="tiebreakServing"
                  type="radio"
                  :value="TEAMS.US"
                  data-field="tiebreak-serving-us"
                />
                Мы
              </label>
              <label class="segmented__option">
                <input
                  v-model="tiebreakServing"
                  type="radio"
                  :value="TEAMS.THEM"
                  data-field="tiebreak-serving-them"
                />
                {{ opponentLabel }}
              </label>
            </div>
          </fieldset>
          <p class="hint">Перед пятой партией подача разыгрывается жребием.</p>
        </template>

        <p v-else class="hint" data-field="next-serving">
          Подаёт первой: {{ nextServingLabel }} (по правилам FIVB)
        </p>
      </section>

      <button
        type="button"
        class="button-block"
        :disabled="!valid || (isFifthSet && !tiebreakServing)"
        data-action="start-next-set"
        @click="startNextSet"
      >
        Начать {{ nextSetNumber }}-ю партию
      </button>
    </template>

    <button
      v-else
      type="button"
      class="button-block"
      :disabled="!valid"
      data-action="next"
      @click="goNext"
    >
      Далее
    </button>

    <LineupPlayerDialog
      v-if="pickingZone !== null"
      :zone="pickingZone"
      :players="dialogPlayers"
      @assign="assign"
      @cancel="pickingZone = null"
    />
  </section>
</template>

<style scoped>
.screen__head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
}

.screen__head h1 {
  margin: 0;
}

.set-break {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 14px;
}

.set-break__title {
  font-weight: 700;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
}

.field__label {
  padding: 0;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.hint {
  color: var(--ink-soft);
  font-size: 0.82rem;
  line-height: 1.45;
}

.libero {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.libero__label {
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.libero select {
  width: 100%;
}

.libero__status {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.button-block {
  width: 100%;
}
</style>
