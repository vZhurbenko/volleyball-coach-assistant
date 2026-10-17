<script setup>
import { computed } from 'vue'

import { ROLE_LABELS, ROLES } from '../domain/constants.js'
import { receivingPositions } from '../domain/formations.js'
import { playersOnCourt } from '../domain/match.js'
import { findPlayer } from '../domain/players.js'

const props = defineProps({
  state: { type: Object, required: true },
  roster: { type: Array, required: true },
  /** `protocol` — по зонам протокола, `game` — реальные позиции приёма. */
  mode: { type: String, default: 'protocol' },
})

defineEmits(['select'])

/** Порядок зон на площадке: передняя линия у сетки, затем задняя. */
const COURT_ZONES = [4, 3, 2, 5, 6, 1]

/**
 * Протокольные позиции — та же половина площадки, но игроки стоят
 * схематично по своим зонам: передняя линия и задняя.
 */
const PROTOCOL_POSITIONS = {
  4: { x: 17, y: 22 },
  3: { x: 50, y: 22 },
  2: { x: 83, y: 22 },
  5: { x: 17, y: 78 },
  6: { x: 50, y: 78 },
  1: { x: 83, y: 78 },
}

const onCourt = computed(() => playersOnCourt(props.state))

/** Роли из стартовой расстановки: переопределённая роль едет вместе с игроком. */
const lineupRoles = computed(() => {
  const roles = {}
  for (const assignment of Object.values(props.state.lineup.zones)) {
    if (assignment) roles[assignment.playerId] = assignment.role
  }
  return roles
})

const positions = computed(() => {
  if (props.mode === 'game') {
    return (
      receivingPositions({
        lineup: props.state.lineup,
        rotations: props.state.rotations,
      }) ?? PROTOCOL_POSITIONS
    )
  }

  return PROTOCOL_POSITIONS
})

const cells = computed(() =>
  COURT_ZONES.map((zone) => {
    const player = findPlayer(props.roster, onCourt.value[zone])
    const role = player ? (lineupRoles.value[player.id] ?? player.role) : null
    const point = positions.value[zone] ?? { x: 50, y: 50 }

    return { zone, player, role, isLibero: role === ROLES.LIBERO, ...point }
  }).filter((cell) => cell.player),
)
</script>

<template>
  <div
    class="court-half"
    role="group"
    :aria-label="mode === 'game' ? 'Площадка в игровом режиме' : 'Расстановка на площадке'"
  >
    <span class="court-half__attack-line" aria-hidden="true"></span>

    <div
      v-for="cell in cells"
      :key="cell.player.id"
      class="court-half__cell"
      :style="{ left: `${cell.x}%`, top: `${cell.y}%` }"
    >
      <span v-if="mode === 'protocol'" class="court-half__zone">{{ cell.zone }}</span>

      <button
        type="button"
        class="court-half__player"
        :class="{ 'court-half__player--libero': cell.isLibero }"
        :data-zone="cell.zone"
        :data-player-id="cell.player.id"
        :data-game-player="mode === 'game' ? cell.player.id : null"
        :data-x="cell.x"
        :data-y="cell.y"
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
.court-half {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  margin: 16px 0 28px;
  border-radius: 16px;
  background: #e2a05f;
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
}

.court-half::before {
  content: '';
  position: absolute;
  top: 0;
  right: 0;
  left: 0;
  height: 3px;
  background: #fff;
}

/* Трёхметровая линия: 3 м из 9 м половины площадки. */
.court-half__attack-line {
  position: absolute;
  top: 33.333%;
  right: 0;
  left: 0;
  height: 2px;
  background: rgb(255 255 255 / 85%);
  z-index: 0;
}

/* Точка на площадке: переезжает при смене режима и ротации. */
.court-half__cell {
  position: absolute;
  z-index: 1;
  transform: translate(-50%, -50%);
  transition:
    left 0.45s cubic-bezier(0.2, 0.8, 0.2, 1),
    top 0.45s cubic-bezier(0.2, 0.8, 0.2, 1);
}

.court-half__zone {
  position: absolute;
  bottom: calc(100% + 3px);
  left: 50%;
  color: rgb(28 36 48 / 60%);
  font-size: 0.7rem;
  font-weight: 600;
  transform: translateX(-50%);
}

.court-half__player {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  width: 64px;
  height: 64px;
  min-width: 0;
  min-height: 0;
  padding: 0;
  border: 2px solid transparent;
  border-radius: 50%;
  background: var(--color-surface);
  color: var(--color-text);
  box-shadow: var(--shadow);
}

.court-half__player--libero {
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
  .court-half__player {
    width: 84px;
    height: 84px;
  }

  .court__number {
    font-size: 1.8rem;
  }

  .court__role {
    max-width: 84px;
    font-size: 0.75rem;
  }
}

@media (prefers-reduced-motion: reduce) {
  .court-half__cell {
    transition: none;
  }
}
</style>
