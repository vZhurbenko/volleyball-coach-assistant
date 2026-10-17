<script setup>
import { ROLE_LABELS } from '../domain/constants.js'
import { findPlayer } from '../domain/players.js'

const props = defineProps({
  lineup: { type: Object, required: true },
  roster: { type: Array, required: true },
})

defineEmits(['select'])

/** Порядок зон на площадке: передняя линия у сетки, затем задняя. */
const COURT_ZONES = [4, 3, 2, 5, 6, 1]

function player(zone) {
  const assignment = props.lineup.zones[zone]
  return assignment ? findPlayer(props.roster, assignment.playerId) : null
}
</script>

<template>
  <div class="court" role="group" aria-label="Площадка">
    <button
      v-for="zone in COURT_ZONES"
      :key="zone"
      type="button"
      class="court__zone"
      :class="{ 'court__zone--filled': lineup.zones[zone] }"
      :data-zone="zone"
      :aria-label="`Зона ${zone}`"
      @click="$emit('select', zone)"
    >
      <span class="court__zone-label">Зона {{ zone }}</span>
      <template v-if="player(zone)">
        <span class="court__number">{{ player(zone).number }}</span>
        <span class="court__name">{{ player(zone).lastName }}</span>
        <span class="court__role">{{ ROLE_LABELS[lineup.zones[zone].role] }}</span>
      </template>
      <span v-else class="court__empty">Назначить</span>
    </button>
  </div>
</template>

<style scoped>
.court {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  padding: 10px;
  border-radius: 14px;
  background: var(--court);
  box-shadow:
    inset 0 3px 0 #fff,
    inset 0 0 0 2px rgb(255 255 255 / 70%);
}

.court__zone {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  min-width: 0;
  min-height: 92px;
  padding: 6px 4px;
  border: 1.5px dashed rgb(255 255 255 / 80%);
  border-radius: 10px;
  background: rgb(255 255 255 / 12%);
  color: #3d2c1b;
  font: inherit;
  text-align: center;
}

.court__zone--filled {
  border: 1.5px solid var(--surface);
  background: var(--surface);
  color: var(--ink);
  box-shadow: var(--shadow);
}

.court__zone-label {
  color: rgb(23 34 46 / 55%);
  font-size: 0.68rem;
  font-weight: 650;
}

.court__number {
  font-size: 1.55rem;
  font-weight: 800;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.court__name {
  max-width: 100%;
  overflow: hidden;
  font-size: clamp(0.78rem, 3.3vw, 0.92rem);
  font-weight: 650;
  letter-spacing: -0.02em;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.court__role {
  color: var(--ink-soft);
  font-size: 0.72rem;
}

.court__empty {
  color: #4a3520;
  font-size: 0.78rem;
  font-weight: 600;
}

@media (min-width: 600px) {
  .court {
    gap: 10px;
    padding: 12px;
  }

  .court__zone {
    min-height: 116px;
  }

  .court__number {
    font-size: 1.75rem;
  }
}
</style>
