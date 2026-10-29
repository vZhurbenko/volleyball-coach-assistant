<script setup>
import { ROLE_LABELS } from '../domain/constants.js'
import { STAT_LABELS, STAT_TONES, STAT_TYPES } from '../domain/stats.js'

defineProps({
  player: { type: Object, required: true },
})

const emit = defineEmits(['stat', 'close'])

const STAT_OPTIONS = Object.values(STAT_TYPES).map((type) => ({
  type,
  label: STAT_LABELS[type],
  tone: STAT_TONES[type],
}))
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section class="menu" role="dialog" aria-modal="true" aria-labelledby="player-menu-title">
      <h2 id="player-menu-title">{{ player.firstName }} {{ player.lastName }}</h2>
      <p class="menu__meta">№{{ player.number }} · {{ ROLE_LABELS[player.role] }}</p>

      <div class="menu__stats">
        <button
          v-for="option in STAT_OPTIONS"
          :key="option.type"
          type="button"
          class="menu__stat"
          :data-stat="option.type"
          :data-tone="option.tone"
          @click="emit('stat', option.type)"
        >
          {{ option.label }}
        </button>
      </div>

      <button
        type="button"
        class="button-secondary"
        data-action="close-menu"
        @click="emit('close')"
      >
        Закрыть
      </button>
    </section>
  </div>
</template>

<style scoped>
.dialog-backdrop {
  position: fixed;
  inset: 0;
  z-index: 20;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  padding: 16px;
  background: rgb(16 24 40 / 45%);
}

.menu {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgb(16 24 40 / 25%);
}

.menu h2 {
  font-size: 1.15rem;
}

.menu__meta {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.menu__stats {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.menu__stat {
  width: 100%;
  border: 1px solid #d7dde5;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
}

.menu__stat[data-tone='positive'] {
  border-color: var(--positive-line);
  background: var(--positive-bg);
  color: var(--positive);
}

.menu__stat[data-tone='negative'] {
  border-color: var(--negative-line);
  background: var(--negative-bg);
  color: var(--negative);
}

.menu .button-secondary {
  width: 100%;
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}
</style>
