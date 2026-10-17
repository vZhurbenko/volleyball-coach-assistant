<script setup>
import { computed } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import SetPointLog from '../components/SetPointLog.vue'
import { TEAMS, currentSet, setWinner } from '../domain/score.js'
import { useMatchStore } from '../stores/match.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const router = useRouter()
const matchStore = useMatchStore()
matchStore.load(props.storage)
const { state, settings } = storeToRefs(matchStore)

const set = computed(() => (state.value ? currentSet(state.value.score) : null))
const teamName = computed(() => settings.value.teamName || 'Мы')
const opponent = computed(() => settings.value.opponent || 'Соперник')
const winnerName = computed(() => {
  if (!set.value) return ''

  return setWinner(set.value) === TEAMS.US ? teamName.value : opponent.value
})
const winnerIsUs = computed(() => (set.value ? setWinner(set.value) === TEAMS.US : true))
</script>

<template>
  <section class="screen">
    <template v-if="state && set">
      <h1 class="set-result__title">Партия {{ set.number }} завершена</h1>

      <div class="set-result__result">
        <p class="set-result__winner">
          Победитель:
          <span :class="winnerIsUs ? 'set-result__name--us' : 'set-result__name--them'">{{
            winnerName
          }}</span>
        </p>
        <p class="set-result__score">{{ set.points.us }}:{{ set.points.them }}</p>
      </div>

      <SetPointLog
        :set="set"
        :history="state.history"
        :team-name="teamName"
        :opponent="opponent"
        tall
      />

      <button
        type="button"
        class="button-block"
        data-action="to-lineup"
        @click="router.push({ name: 'lineup' })"
      >
        К расстановке
      </button>
    </template>

    <p v-else>Партия ещё не завершена.</p>
  </section>
</template>

<style scoped>
.set-result__title {
  font-size: clamp(1.25rem, 4vw, 1.6rem);
  line-height: 1.2;
}

.set-result__result {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 10px;
  border-bottom: 1px solid var(--line);
}

.set-result__winner {
  color: var(--ink-soft);
  font-size: 0.9rem;
}

.set-result__winner span {
  font-weight: 700;
}

.set-result__name--us {
  color: var(--us-deep);
}

.set-result__name--them {
  color: var(--them-deep);
}

.set-result__score {
  color: var(--ink);
  font-size: 1.6rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.button-block {
  width: 100%;
}
</style>
