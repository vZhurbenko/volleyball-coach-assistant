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
        class="scoreboard__side scoreboard__side--us"
        :class="{ 'scoreboard__side--serving': serving === TEAMS.US }"
        data-side="us"
        :aria-label="`Очко нам. ${teamName}, ${set.points.us}${serving === TEAMS.US ? ', подача' : ''}`"
        @click="$emit('point', TEAMS.US)"
      >
        <span :key="set.points.us" class="scoreboard__points" data-field="points-us">
          {{ set.points.us }}
        </span>
        <span class="scoreboard__team-bar">
          <span class="scoreboard__team" data-field="team-us">{{ teamName }}</span>
          <span class="scoreboard__serve" data-field="serve-us">{{
            serving === TEAMS.US ? 'подача' : ''
          }}</span>
        </span>
      </button>

      <button
        type="button"
        class="scoreboard__side scoreboard__side--them"
        :class="{ 'scoreboard__side--serving': serving === TEAMS.THEM }"
        data-side="them"
        :aria-label="`Очко сопернику. ${opponent}, ${set.points.them}${serving === TEAMS.THEM ? ', подача' : ''}`"
        @click="$emit('point', TEAMS.THEM)"
      >
        <span :key="set.points.them" class="scoreboard__points" data-field="points-them">
          {{ set.points.them }}
        </span>
        <span class="scoreboard__team-bar">
          <span class="scoreboard__team" data-field="team-them">{{ opponent }}</span>
          <span class="scoreboard__serve" data-field="serve-them">{{
            serving === TEAMS.THEM ? 'подача' : ''
          }}</span>
        </span>
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
  font-variant-numeric: tabular-nums;
}

.scoreboard__sides {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

/* Карточка — большая кнопка начисления очка. */
.scoreboard__side {
  --team-color: var(--color-primary);

  display: flex;
  flex-direction: column;
  min-height: 120px;
  padding: 0;
  overflow: hidden;
  border: 0;
  border-radius: 14px;
  background: var(--color-surface);
  color: #273449;
  box-shadow: 0 2px 10px rgb(16 24 40 / 10%);
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.scoreboard__side--us {
  --team-color: #1d4ed8;
}

.scoreboard__side--them {
  --team-color: #b91c1c;
}

.scoreboard__side--serving {
  color: var(--team-color);
}

.scoreboard__points {
  display: flex;
  flex: 1;
  align-items: center;
  justify-content: center;
  font-size: clamp(2.5rem, 13vw, 4.25rem);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 0.9;
  animation: score-pop 0.16s ease-out;
}

.scoreboard__side:not(.scoreboard__side--serving) .scoreboard__points {
  color: #273449;
}

.scoreboard__team-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 38px;
  padding: 4px 10px;
  background: transparent;
  color: var(--color-muted);
  font-size: clamp(0.9rem, 3vw, 1.05rem);
  font-weight: 600;
  transition:
    background-color 0.18s ease,
    color 0.18s ease;
}

.scoreboard__side--serving .scoreboard__team-bar {
  background: var(--team-color);
  color: #fff;
}

.scoreboard__team {
  overflow-wrap: anywhere;
  text-align: center;
}

.scoreboard__serve {
  font-size: 0.68rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  opacity: 0.85;
}

.scoreboard__streaks {
  min-height: 1.5em;
  color: var(--color-muted);
  font-size: 0.9rem;
}

@keyframes score-pop {
  from {
    transform: scale(1.08);
    opacity: 0.6;
  }

  to {
    transform: scale(1);
    opacity: 1;
  }
}

@media (min-width: 600px) {
  .scoreboard__sides {
    gap: 10px;
  }

  .scoreboard__side {
    border-radius: 16px;
  }

  .scoreboard__team-bar {
    min-height: 42px;
  }
}

@media (prefers-reduced-motion: reduce) {
  .scoreboard__points {
    animation: none;
  }

  .scoreboard__side,
  .scoreboard__team-bar {
    transition: none;
  }
}
</style>
