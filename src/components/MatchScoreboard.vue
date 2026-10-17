<script setup>
import { computed } from 'vue'

import { TEAMS, currentSet, pointsToWin, setsWon } from '../domain/score.js'

const props = defineProps({
  state: { type: Object, required: true },
  teamName: { type: String, default: 'Мы' },
  opponent: { type: String, default: 'Соперник' },
})

defineEmits(['point'])

const set = computed(() => currentSet(props.state.score))
const won = computed(() => setsWon(props.state.score))
const serving = computed(() => props.state.score.serving)

const streaks = computed(() =>
  props.state.streaks
    .filter((streak) => streak.setNumber === set.value.number)
    .map(
      (streak) => `${streak.team === TEAMS.US ? props.teamName : props.opponent} +${streak.points}`,
    ),
)

const streakText = computed(() =>
  streaks.value.length ? streaks.value.join(' · ') : 'Серий пока нет',
)
</script>

<template>
  <section class="scoreboard" aria-label="Счёт">
    <div class="scoreboard__meta">
      <span>Партия {{ set.number }} · до {{ pointsToWin(set.number) }}</span>
      <span>Партии {{ won.us }}:{{ won.them }}</span>
    </div>

    <div class="scoreboard__sides">
      <button
        type="button"
        class="scoreboard__side"
        :class="{ 'scoreboard__side--serving': serving === TEAMS.US }"
        data-side="us"
        aria-label="Очко нам"
        @click="$emit('point', TEAMS.US)"
      >
        <span class="scoreboard__team" data-field="team-us">{{ teamName }}</span>
        <span class="scoreboard__points" data-field="points-us">{{ set.points.us }}</span>
        <span class="scoreboard__serve" data-field="serve-us">{{
          serving === TEAMS.US ? 'подача' : ''
        }}</span>
      </button>

      <button
        type="button"
        class="scoreboard__side"
        :class="{ 'scoreboard__side--serving': serving === TEAMS.THEM }"
        data-side="them"
        :aria-label="`Очко сопернику: ${opponent}`"
        @click="$emit('point', TEAMS.THEM)"
      >
        <span class="scoreboard__team" data-field="team-them">{{ opponent }}</span>
        <span class="scoreboard__points" data-field="points-them">{{ set.points.them }}</span>
        <span class="scoreboard__serve" data-field="serve-them">{{
          serving === TEAMS.THEM ? 'подача' : ''
        }}</span>
      </button>
    </div>

    <p class="scoreboard__streaks" data-field="streaks">{{ streakText }}</p>
  </section>
</template>

<style scoped>
.scoreboard {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.scoreboard__meta {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  color: var(--color-muted);
  font-size: 0.85rem;
}

.scoreboard__sides {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.scoreboard__side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-height: 120px;
  padding: 12px 8px;
  border: 2px solid transparent;
  border-radius: var(--radius);
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow);
}

.scoreboard__side--serving {
  border-color: var(--color-primary);
  background: #e8f0fd;
}

.scoreboard__team {
  overflow-wrap: anywhere;
  font-size: 0.9rem;
  font-weight: 600;
}

.scoreboard__points {
  font-size: 2.75rem;
  font-weight: 700;
  line-height: 1;
}

.scoreboard__serve {
  min-height: 1.2em;
  color: var(--color-primary);
  font-size: 0.75rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.scoreboard__streaks {
  min-height: 1.5em;
  font-size: 0.9rem;
}
</style>
