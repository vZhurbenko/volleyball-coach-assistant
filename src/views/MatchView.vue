<script setup>
import { ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import MatchCourt from '../components/MatchCourt.vue'
import MatchPlayerMenu from '../components/MatchPlayerMenu.vue'
import MatchScoreboard from '../components/MatchScoreboard.vue'
import MatchSubstitutionDialog from '../components/MatchSubstitutionDialog.vue'
import { TEAM_ROSTER, findPlayer } from '../domain/players.js'
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

function openPlayer(playerId) {
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
    <h1>Матч</h1>

    <template v-if="state">
      <MatchScoreboard
        :state="state"
        :team-name="settings.teamName || 'Мы'"
        :opponent="settings.opponent || 'Соперник'"
        @point="matchStore.addPoint"
      />

      <MatchCourt :state="state" :roster="TEAM_ROSTER" @select="openPlayer" />

      <button
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
