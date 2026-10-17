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
</script>

<template>
  <section class="screen">
    <template v-if="state && set">
      <h1 class="set-result__title">Партия {{ set.number }} завершена</h1>
      <p class="set-result__winner">
        Победитель: {{ winnerName }} · {{ set.points.us }}:{{ set.points.them }}
      </p>

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

.set-result__winner {
  color: var(--color-muted);
}

.button-block {
  width: 100%;
}
</style>
