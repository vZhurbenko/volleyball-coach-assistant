<script setup>
import { computed, ref } from 'vue'

import { ROLE_LABELS, ROLES, ZONES } from '../domain/constants.js'
import { playersOnCourt } from '../domain/match.js'
import { findPlayer } from '../domain/players.js'
import { SUBSTITUTION_MODES, substitute, substitutionsLeft } from '../domain/substitutions.js'

const props = defineProps({
  state: { type: Object, required: true },
  roster: { type: Array, required: true },
  mode: { type: String, default: SUBSTITUTION_MODES.FIVB },
})

const emit = defineEmits(['substitute', 'close'])

const outgoingId = ref(null)
const incomingId = ref(null)
const exceptional = ref(false)

const left = computed(() => substitutionsLeft(props.state.substitutions))

const onCourtPlayers = computed(() => {
  const zones = playersOnCourt(props.state)

  return ZONES.map((zone) => findPlayer(props.roster, zones[zone]))
    .filter(Boolean)
    .filter((player) => player.role !== ROLES.LIBERO)
})

const onCourtIds = computed(() => new Set(onCourtPlayers.value.map((player) => player.id)))

const benchPlayers = computed(() =>
  props.roster.filter(
    (player) =>
      !onCourtIds.value.has(player.id) &&
      player.role !== ROLES.LIBERO &&
      !props.state.substitutions.retired.includes(player.id),
  ),
)

/** Предпросмотр замены: ядро само объясняет, почему вариант недопустим. */
const preview = computed(() => {
  if (!outgoingId.value || !incomingId.value) return null

  return substitute(props.state.substitutions, {
    outgoingId: outgoingId.value,
    incomingId: incomingId.value,
    exceptional: exceptional.value,
    mode: props.mode,
  })
})

const reason = computed(() =>
  preview.value && !preview.value.ok ? preview.value.reason.message : null,
)
const canConfirm = computed(() => preview.value?.ok === true)

function confirm() {
  if (!canConfirm.value) return

  emit('substitute', {
    outgoingId: outgoingId.value,
    incomingId: incomingId.value,
    exceptional: exceptional.value,
  })
}
</script>

<template>
  <div class="dialog-backdrop" @click.self="emit('close')">
    <section
      class="substitution"
      role="dialog"
      aria-modal="true"
      aria-labelledby="substitution-title"
    >
      <h2 id="substitution-title">Замена</h2>
      <p class="substitution__left" data-field="substitutions-left">
        Осталось замен в партии: {{ left }}
      </p>
      <p v-if="mode === SUBSTITUTION_MODES.COUNT" class="hint">
        Упрощённый режим: проверяется только количество. Замены либеро — по правилам FIVB.
      </p>

      <fieldset class="group">
        <legend>Кто уходит</legend>
        <div class="options">
          <button
            v-for="player in onCourtPlayers"
            :key="player.id"
            type="button"
            class="options__item"
            :class="{ 'options__item--selected': player.id === outgoingId }"
            :data-sub-out="player.id"
            :aria-pressed="player.id === outgoingId"
            @click="outgoingId = player.id"
          >
            <span class="options__number">{{ player.number }}</span>
            <span class="options__name">{{ player.lastName }}</span>
            <span class="options__role">{{ ROLE_LABELS[player.role] }}</span>
          </button>
        </div>
      </fieldset>

      <fieldset class="group">
        <legend>Кто выходит</legend>
        <div class="options">
          <button
            v-for="player in benchPlayers"
            :key="player.id"
            type="button"
            class="options__item"
            :class="{ 'options__item--selected': player.id === incomingId }"
            :data-sub-in="player.id"
            :aria-pressed="player.id === incomingId"
            @click="incomingId = player.id"
          >
            <span class="options__number">{{ player.number }}</span>
            <span class="options__name">{{ player.lastName }}</span>
            <span class="options__role">{{ ROLE_LABELS[player.role] }}</span>
          </button>
        </div>
      </fieldset>

      <template v-if="mode === SUBSTITUTION_MODES.FIVB">
        <label class="exceptional">
          <input v-model="exceptional" type="checkbox" data-field="exceptional" />
          <span>Исключительная замена</span>
        </label>
        <p class="hint">Сверх лимита; заменённый выбывает до конца матча.</p>
      </template>

      <p v-if="reason" class="reason" role="alert" data-field="substitution-reason">
        {{ reason }}
      </p>

      <button
        type="button"
        data-action="confirm-substitution"
        :disabled="!canConfirm"
        @click="confirm"
      >
        Заменить
      </button>
      <button
        type="button"
        class="button-secondary"
        data-action="cancel-substitution"
        @click="emit('close')"
      >
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
  background: rgb(16 24 40 / 45%);
}

.substitution {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 560px;
  max-height: 85vh;
  max-height: 85dvh;
  overflow-y: auto;
  padding: 20px;
  border-radius: 16px;
  background: var(--color-surface);
  box-shadow: 0 10px 30px rgb(16 24 40 / 25%);
}

.substitution h2 {
  font-size: 1.15rem;
}

.substitution__left {
  color: var(--color-muted);
  font-size: 0.9rem;
}

.group {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
}

.group legend {
  margin-bottom: 6px;
  font-weight: 600;
}

.options {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.options__item {
  display: grid;
  grid-template-columns: 36px 1fr auto;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 4px 10px;
  border: 1px solid #d7dde5;
  border-radius: 10px;
  background: var(--color-surface);
  color: var(--color-text);
  text-align: left;
}

.options__item--selected {
  border-color: var(--color-primary);
  background: #e8f0fd;
}

.options__number {
  font-weight: 700;
}

.options__role {
  color: var(--color-muted);
  font-size: 0.8rem;
}

.exceptional {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: var(--tap-size);
  font-weight: 500;
}

.hint {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.reason {
  padding: 10px 12px;
  border-radius: var(--radius);
  background: #fdeceb;
  color: #8a1f1a;
  font-size: 0.9rem;
}

.substitution .button-secondary {
  width: 100%;
}

@media (min-width: 600px) {
  .dialog-backdrop {
    align-items: center;
  }
}
</style>
