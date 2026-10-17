<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import LineupCourt from '../components/LineupCourt.vue'
import LineupPlayerDialog from '../components/LineupPlayerDialog.vue'
import { ROLES } from '../domain/constants.js'
import { findPlayer } from '../domain/players.js'
import { TEAMS, currentSet, isMatchOver, isSetOver } from '../domain/score.js'
import { useLineupStore } from '../stores/lineup.js'
import { useMatchStore } from '../stores/match.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const lineupStore = useLineupStore()
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
    <h1>Расстановка</h1>
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
      <section class="set-break" data-field="set-break">
        <p class="set-break__title">Партия {{ state.setNumber }} завершена</p>

        <template v-if="isFifthSet">
          <fieldset class="field field--choice">
            <legend class="field__label">Кто подаёт первым в 5-й партии</legend>
            <label class="choice">
              <input
                v-model="tiebreakServing"
                type="radio"
                :value="TEAMS.US"
                data-field="tiebreak-serving-us"
              />
              Мы
            </label>
            <label class="choice">
              <input
                v-model="tiebreakServing"
                type="radio"
                :value="TEAMS.THEM"
                data-field="tiebreak-serving-them"
              />
              {{ opponentLabel }}
            </label>
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
      :players="roster"
      @assign="assign"
      @cancel="pickingZone = null"
    />
  </section>
</template>

<style scoped>
.violations {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 12px 12px 12px 28px;
  border-radius: var(--radius);
  background: #fdeceb;
  color: #8a1f1a;
  font-size: 0.95rem;
}

.set-break {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius);
  background: #eef3fb;
}

.set-break__title {
  font-weight: 600;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
}

.field--choice {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
}

.field--choice legend {
  width: 100%;
  padding: 0;
}

.field__label {
  font-weight: 600;
}

.choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: var(--tap-size);
  font-weight: 500;
}

.hint {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.libero {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.libero__label {
  font-weight: 600;
}

.libero select {
  width: 100%;
}

.libero__status {
  font-size: 0.9rem;
}

.button-block {
  width: 100%;
}
</style>
