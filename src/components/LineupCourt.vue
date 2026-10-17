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
  border-radius: 16px;
  background: #e2a05f;
  box-shadow: inset 0 0 0 3px rgb(255 255 255 / 55%);
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
  border: 2px solid rgb(255 255 255 / 70%);
  border-radius: 10px;
  background: rgb(255 255 255 / 16%);
  color: var(--color-text);
  font: inherit;
  text-align: center;
}

.court__zone--filled {
  background: var(--color-surface);
  box-shadow: var(--shadow);
}

.court__zone-label {
  color: rgb(28 36 48 / 65%);
  font-size: 0.75rem;
}

.court__number {
  font-size: 1.5rem;
  font-weight: 700;
  line-height: 1;
}

.court__name {
  font-size: 0.95rem;
  font-weight: 600;
}

.court__role {
  color: var(--color-muted);
  font-size: 0.75rem;
}

.court__empty {
  color: var(--color-muted);
  font-size: 0.8rem;
}

@media (min-width: 600px) {
  .court {
    gap: 12px;
    padding: 14px;
  }

  .court__zone {
    min-height: 120px;
  }

  .court__number {
    font-size: 1.8rem;
  }
}
</style>
