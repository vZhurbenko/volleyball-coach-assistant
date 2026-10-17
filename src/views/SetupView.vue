<script setup>
import { ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import { EVENT_TYPES } from '../domain/match.js'
import { TEAMS } from '../domain/score.js'
import { SUBSTITUTION_MODES } from '../domain/substitutions.js'
import { loadMatch, saveMatch } from '../storage.js'
import { useLineupStore } from '../stores/lineup.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const router = useRouter()
const lineupStore = useLineupStore()
const { lineup } = storeToRefs(lineupStore)

const saved = loadMatch(props.storage)
const teamName = ref(saved?.settings?.teamName ?? '')
const opponent = ref(saved?.settings?.opponent ?? '')
const serving = ref(saved?.settings?.serving ?? TEAMS.US)
const substitutionMode = ref(saved?.settings?.substitutionMode ?? SUBSTITUTION_MODES.COUNT)

function startGame() {
  const team = teamName.value.trim()
  const opponentName = opponent.value.trim()
  if (!team || !opponentName) return

  saveMatch(
    {
      events: [
        {
          type: EVENT_TYPES.SET_START,
          lineup: lineup.value,
          serving: serving.value,
        },
      ],
      settings: {
        teamName: team,
        opponent: opponentName,
        lineup: lineup.value,
        serving: serving.value,
        substitutionMode: substitutionMode.value,
      },
    },
    props.storage,
  )

  router.push({ name: 'match' })
}
</script>

<template>
  <section class="screen">
    <h1>Настройка игры</h1>

    <form class="setup-form" @submit.prevent="startGame">
      <div class="field">
        <label class="field__label" for="setup-team-name">Наша команда</label>
        <input
          id="setup-team-name"
          v-model="teamName"
          data-field="team-name"
          type="text"
          autocomplete="off"
          placeholder="Название команды"
        />
      </div>

      <div class="field">
        <label class="field__label" for="setup-opponent">Команда соперника</label>
        <input
          id="setup-opponent"
          v-model="opponent"
          data-field="opponent"
          type="text"
          autocomplete="off"
          placeholder="Например, «Динамо»"
        />
      </div>

      <fieldset class="field field--choice">
        <legend class="field__label">Кто подаёт первым</legend>
        <label class="choice">
          <input v-model="serving" type="radio" :value="TEAMS.US" data-field="serving-us" />
          Мы
        </label>
        <label class="choice">
          <input v-model="serving" type="radio" :value="TEAMS.THEM" data-field="serving-them" />
          Соперник
        </label>
      </fieldset>

      <fieldset class="field field--choice">
        <legend class="field__label">Правила замен</legend>
        <label class="choice">
          <input
            v-model="substitutionMode"
            type="radio"
            :value="SUBSTITUTION_MODES.COUNT"
            data-field="substitution-count"
          />
          Только количество
        </label>
        <label class="choice">
          <input
            v-model="substitutionMode"
            type="radio"
            :value="SUBSTITUTION_MODES.FIVB"
            data-field="substitution-fivb"
          />
          По правилам FIVB
        </label>
      </fieldset>
      <p class="hint">
        В упрощённом режиме проверяется только лимит. Замены либеро в обоих режимах — по правилам
        FIVB.
      </p>

      <button
        type="submit"
        class="button-block"
        :disabled="!teamName.trim() || !opponent.trim()"
        data-action="start"
      >
        Начать игру
      </button>
    </form>
  </section>
</template>

<style scoped>
.setup-form {
  display: flex;
  flex-direction: column;
  gap: var(--gap);
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 0;
  border: 0;
}

.field__label {
  font-weight: 600;
}

.field input[type='text'] {
  width: 100%;
}

.field--choice {
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 20px;
}

.field--choice legend {
  width: 100%;
  padding: 0;
}

.choice {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  min-height: var(--tap-size);
  font-weight: 500;
}

.hint {
  color: var(--color-muted);
  font-size: 0.85rem;
}

.button-block {
  width: 100%;
}
</style>
