<script setup>
import { computed } from 'vue'

import { ROLE_LABELS, ROLES } from '../domain/constants.js'
import { playersOnCourt } from '../domain/match.js'
import { findPlayer } from '../domain/players.js'

const props = defineProps({
  state: { type: Object, required: true },
  roster: { type: Array, required: true },
})

defineEmits(['select'])

/** Порядок зон на площадке: передняя линия у сетки, затем задняя. */
const COURT_ZONES = [4, 3, 2, 5, 6, 1]

const onCourt = computed(() => playersOnCourt(props.state))

/** Роли из стартовой расстановки: переопределённая роль едет вместе с игроком. */
const lineupRoles = computed(() => {
  const roles = {}
  for (const assignment of Object.values(props.state.lineup.zones)) {
    if (assignment) roles[assignment.playerId] = assignment.role
  }
  return roles
})

const cells = computed(() =>
  COURT_ZONES.map((zone) => {
    const player = findPlayer(props.roster, onCourt.value[zone])
    const role = player ? (lineupRoles.value[player.id] ?? player.role) : null

    return { zone, player, role, isLibero: role === ROLES.LIBERO }
  }),
)
</script>

<template>
  <div class="court" role="group" aria-label="Расстановка на площадке">
    <div v-for="cell in cells" :key="cell.zone" class="court__cell">
      <span class="court__zone-label">{{ cell.zone }}</span>
      <button
        v-if="cell.player"
        type="button"
        class="court__player"
        :class="{ 'court__player--libero': cell.isLibero }"
        :data-zone="cell.zone"
        :data-player-id="cell.player.id"
        :aria-label="`Зона ${cell.zone}: ${cell.player.lastName}, ${ROLE_LABELS[cell.role]}`"
        @click="$emit('select', cell.player.id)"
      >
        <span class="court__number">{{ cell.player.number }}</span>
        <span class="court__role">{{ ROLE_LABELS[cell.role] }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.court {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 16px;
  background: #e2a05f;
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
}

.court__cell {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 88px;
  border: 2px solid rgb(255 255 255 / 70%);
  border-radius: 10px;
}

.court__zone-label {
  position: absolute;
  top: 3px;
  left: 6px;
  color: rgb(28 36 48 / 55%);
  font-size: 0.7rem;
  font-weight: 600;
}

.court__player {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 74px;
  height: 74px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow);
}

.court__player--libero {
  border-color: var(--color-primary);
}

.court__number {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.court__role {
  max-width: 66px;
  color: var(--color-muted);
  font-size: 0.625rem;
  line-height: 1.1;
  text-align: center;
}

@media (min-width: 600px) {
  .court__cell {
    min-height: 112px;
  }

  .court__player {
    width: 92px;
    height: 92px;
  }

  .court__number {
    font-size: 1.8rem;
  }

  .court__role {
    max-width: 84px;
    font-size: 0.75rem;
  }
}
</style>
