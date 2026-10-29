<script setup>
import { ref } from 'vue'

import { COURT_ROLES, ROLE_LABELS } from '../domain/constants.js'

defineProps({
  zone: { type: Number, required: true },
  players: { type: Array, required: true },
})

const emit = defineEmits(['assign', 'cancel'])

const selected = ref(null)

function assign(role) {
  emit('assign', { playerId: selected.value.id, role })
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('cancel')">
    <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="lineup-dialog-title">
      <template v-if="!selected">
        <h2 id="lineup-dialog-title">Зона {{ zone }}: игрок</h2>
        <ul class="player-list">
          <li v-for="player in players" :key="player.id">
            <button
              type="button"
              class="player-list__item"
              :data-player-id="player.id"
              @click="selected = player"
            >
              <span class="player-list__number">{{ player.number }}</span>
              <span class="player-list__name">{{ player.firstName }} {{ player.lastName }}</span>
              <span class="player-list__role">{{ ROLE_LABELS[player.role] }}</span>
            </button>
          </li>
        </ul>
      </template>

      <template v-else>
        <h2 id="lineup-dialog-title">{{ selected.lastName }}: роль</h2>
        <p class="dialog__hint">
          По составу — {{ ROLE_LABELS[selected.role] }}. Роль можно переопределить.
        </p>
        <div class="role-list">
          <button
            v-for="role in COURT_ROLES"
            :key="role"
            type="button"
            class="role-list__item"
            :class="{ 'role-list__item--current': role === selected.role }"
            :data-role="role"
            @click="assign(role)"
          >
            {{ ROLE_LABELS[role] }}
          </button>
        </div>
        <button type="button" class="button-secondary" data-action="back" @click="selected = null">
          Назад
        </button>
      </template>

      <button type="button" class="button-secondary" data-action="cancel" @click="emit('cancel')">
        Отмена
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
  background: rgb(28 35 41 / 45%);
}

.dialog {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 480px;
  max-height: 85vh;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 18px;
  border: 1px solid var(--line);
  border-radius: 16px;
  background: var(--surface);
  box-shadow: var(--shadow-modal);
}

.dialog h2 {
  font-size: 1.1rem;
  font-weight: 750;
}

.dialog__hint {
  color: var(--ink-soft);
  font-size: 0.85rem;
}

.dialog .button-secondary {
  width: 100%;
}

.player-list {
  display: flex;
  flex-direction: column;
  min-height: 0;
  padding: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid var(--line);
  border-radius: 12px;
  list-style: none;
}

.player-list li + li {
  border-top: 1px solid var(--line);
}

.player-list__item {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: var(--tap-size);
  padding: 6px 12px;
  border: 0;
  border-radius: 0;
  background: var(--surface);
  color: var(--ink);
  text-align: left;
}

.player-list__number {
  font-weight: 750;
  font-variant-numeric: tabular-nums;
}

.player-list__name {
  font-weight: 600;
}

.player-list__role {
  color: var(--ink-soft);
  font-size: 0.8rem;
}

.role-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.role-list__item {
  border: 1.5px solid var(--line-strong);
  background: var(--surface);
  color: var(--ink);
  font-size: 0.88rem;
  font-weight: 650;
}

.role-list__item--current {
  border-color: var(--color-primary);
  color: var(--color-primary);
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}
</style>
