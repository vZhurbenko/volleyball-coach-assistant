<script setup>
import { computed, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import MatchCourt from '../components/MatchCourt.vue'
import MatchPlayerMenu from '../components/MatchPlayerMenu.vue'
import MatchScoreboard from '../components/MatchScoreboard.vue'
import MatchSubstitutionDialog from '../components/MatchSubstitutionDialog.vue'
import { TEAM_ROSTER, findPlayer } from '../domain/players.js'
import { TEAMS, currentSet, isMatchOver, isSetOver, setWinner } from '../domain/score.js'
import { useMatchStore } from '../stores/match.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const router = useRouter()
const matchStore = useMatchStore()
matchStore.load(props.storage)

const { state, settings, canUndo, substitutionsLeft, substitutionMode } = storeToRefs(matchStore)
const confirmingReset = ref(false)
const selectedPlayer = ref(null)
const substitutionOpen = ref(false)
const courtMode = ref('protocol')

const currentSetScore = computed(() => (state.value ? currentSet(state.value.score) : null))
const setOver = computed(() => (state.value ? isSetOver(currentSet(state.value.score)) : false))
const matchOver = computed(() => (state.value ? isMatchOver(state.value.score) : false))
const betweenSets = computed(() => setOver.value && !matchOver.value)
const setWinnerName = computed(() => {
  if (!state.value) return ''

  const winner = setWinner(currentSet(state.value.score))
  return winner === TEAMS.US
    ? settings.value.teamName || 'Мы'
    : settings.value.opponent || 'Соперник'
})

function openPlayer(playerId) {
  if (setOver.value) return

  selectedPlayer.value = findPlayer(TEAM_ROSTER, playerId) ?? null
}

function recordStat(statType) {
  if (!selectedPlayer.value) return

  matchStore.addStat(selectedPlayer.value.id, statType)
  selectedPlayer.value = null
}

function applySubstitution(request) {
  const result = matchStore.addSubstitution(request)
  if (result.ok) substitutionOpen.value = false
}

function resetMatch() {
  matchStore.reset()
  router.push({ name: 'lineup' })
}
</script>

<template>
  <section class="screen">
    <template v-if="state">
      <MatchScoreboard
        :state="state"
        :team-name="settings.teamName || 'Мы'"
        :opponent="settings.opponent || 'Соперник'"
        @point="matchStore.addPoint"
      />

      <div v-if="matchOver" class="set-end" data-field="match-end">
        <h2>Матч завершён</h2>
        <p>Победитель: {{ setWinnerName }}</p>
        <button type="button" data-action="go-summary" @click="router.push({ name: 'summary' })">
          К итогам матча
        </button>
      </div>

      <div class="court-switch" role="group" aria-label="Режим площадки">
        <button
          type="button"
          class="court-switch__option"
          :class="{ 'court-switch__option--active': courtMode === 'protocol' }"
          :aria-pressed="courtMode === 'protocol'"
          data-field="court-mode-protocol"
          @click="courtMode = 'protocol'"
        >
          Протокольный
        </button>
        <button
          type="button"
          class="court-switch__option"
          :class="{ 'court-switch__option--active': courtMode === 'game' }"
          :aria-pressed="courtMode === 'game'"
          data-field="court-mode-game"
          @click="courtMode = 'game'"
        >
          Игровой (приём)
        </button>
      </div>

      <MatchCourt :state="state" :roster="TEAM_ROSTER" :mode="courtMode" @select="openPlayer" />

      <button
        v-if="!setOver"
        type="button"
        class="button-block"
        data-action="open-substitution"
        @click="substitutionOpen = true"
      >
        Замена · осталось {{ substitutionsLeft }}
      </button>

      <div class="match-actions">
        <button
          type="button"
          class="button-secondary"
          :disabled="!canUndo"
          data-action="undo"
          @click="matchStore.undo"
        >
          Отменить очко
        </button>
        <button
          type="button"
          class="button-secondary button-secondary--danger"
          data-action="reset"
          @click="confirmingReset = true"
        >
          Сбросить
        </button>
      </div>

      <MatchPlayerMenu
        v-if="selectedPlayer"
        :player="selectedPlayer"
        @stat="recordStat"
        @close="selectedPlayer = null"
      />

      <MatchSubstitutionDialog
        v-if="substitutionOpen"
        :state="state"
        :roster="TEAM_ROSTER"
        :mode="substitutionMode"
        @substitute="applySubstitution"
        @close="substitutionOpen = false"
      />

      <div v-if="betweenSets" class="set-end-backdrop" data-field="set-end">
        <section
          class="set-end-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="set-end-title"
        >
          <h2 id="set-end-title">Партия {{ state.setNumber }} завершена</h2>
          <p>
            Победитель: {{ setWinnerName }} · {{ currentSetScore.points.us }}:{{
              currentSetScore.points.them
            }}
          </p>
          <button type="button" data-action="next-set" @click="router.push({ name: 'set-result' })">
            Дальше
          </button>
          <button
            type="button"
            class="button-secondary"
            data-action="undo-set-point"
            @click="matchStore.undo"
          >
            Отменить очко
          </button>
        </section>
      </div>

      <div v-if="confirmingReset" class="reset-confirm" role="alert">
        <p>Сбросить матч и вернуться к расстановке?</p>
        <button type="button" data-action="confirm-reset" @click="resetMatch">Сбросить</button>
        <button
          type="button"
          class="button-secondary"
          data-action="cancel-reset"
          @click="confirmingReset = false"
        >
          Отмена
        </button>
      </div>
    </template>

    <p v-else>Матч не начат. Вернитесь к расстановке.</p>
  </section>
</template>

<style scoped>
.set-end {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border-radius: var(--radius);
  background: #eef3fb;
}

.set-end h2 {
  font-size: 1.1rem;
}

.set-end p {
  color: var(--color-muted);
}

.set-end-backdrop {
  position: fixed;
  inset: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: rgb(16 24 40 / 45%);
}

.set-end-modal {
  display: flex;
  flex-direction: column;
  gap: 10px;
  width: 100%;
  max-width: 420px;
  padding: 20px;
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgb(16 24 40 / 25%);
}

.set-end-modal h2 {
  font-size: 1.15rem;
}

.set-end-modal p {
  color: var(--color-muted);
}

.set-end-modal .button-secondary {
  width: 100%;
}

.court-switch {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 3px;
  padding: 3px;
  border-radius: 10px;
  background: #e5e9ef;
}

.court-switch__option {
  min-height: 34px;
  padding: 0 6px;
  border-radius: 7px;
  background: transparent;
  color: var(--color-muted);
  font-size: 0.82rem;
  font-weight: 600;
}

.court-switch__option--active {
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow);
}

.match-actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.button-secondary--danger {
  border-color: #b42318;
  color: #b42318;
}

.reset-confirm {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
  border: 1px solid #f0c2bd;
  border-radius: var(--radius);
  background: #fdeceb;
}

.reset-confirm p {
  color: #8a1f1a;
}
</style>
