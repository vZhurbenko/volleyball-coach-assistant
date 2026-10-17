<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import LineupCourt from '../components/LineupCourt.vue'
import LineupPlayerDialog from '../components/LineupPlayerDialog.vue'
import { ROLES } from '../domain/constants.js'
import { findPlayer } from '../domain/players.js'
import { useLineupStore } from '../stores/lineup.js'

const lineupStore = useLineupStore()
const { roster, lineup, validation } = storeToRefs(lineupStore)
const router = useRouter()

const valid = computed(() => validation.value.valid)
const violations = computed(() => validation.value.violations)
const liberoPlayers = computed(() => roster.value.filter((player) => player.role === ROLES.LIBERO))
const liberoName = computed(() => {
  const player = findPlayer(roster.value, lineup.value.liberoId)
  return player ? `${player.firstName} ${player.lastName}` : null
})

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

    <button
      type="button"
      class="button-block"
      :disabled="!valid"
      data-action="next"
      @click="goNext"
    >
      Далее
    </button>
  </section>

  <LineupPlayerDialog
    v-if="pickingZone !== null"
    :zone="pickingZone"
    :players="roster"
    @assign="assign"
    @cancel="pickingZone = null"
  />
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
