<script setup>
import { computed, ref } from 'vue'

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
lineupStore.load(props.storage)
const { lineup } = storeToRefs(lineupStore)

const saved = loadMatch(props.storage)
const teamName = ref(saved?.settings?.teamName ?? lineupStore.defaultTeamName)
const opponent = ref(saved?.settings?.opponent ?? '')
const serving = ref(saved?.settings?.serving ?? TEAMS.US)
const substitutionMode = ref(saved?.settings?.substitutionMode ?? SUBSTITUTION_MODES.COUNT)

/** Матч не начинается, пока шесть зон не заполнены и роли не сходятся. */
const rosterReady = computed(() => lineupStore.validation.valid)

/** При фокусе выделяем подставленное название — ввод сразу заменит его. */
function selectDefaultName(event) {
  if (event.target.value === lineupStore.defaultTeamName) event.target.select()
}

function startGame() {
  const team = teamName.value.trim()
  const opponentName = opponent.value.trim()
  if (!team || !opponentName || !rosterReady.value) return

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

    <form class="setup-form board board--pad" @submit.prevent="startGame">
      <div class="field">
        <label class="field__label" for="setup-team-name">Наша команда</label>
        <input
          id="setup-team-name"
          v-model="teamName"
          data-field="team-name"
          type="text"
          autocomplete="off"
          placeholder="Название команды"
          @focus="selectDefaultName"
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

      <fieldset class="field">
        <legend class="field__label">Кто подаёт первым</legend>
        <div class="segmented">
          <label class="segmented__option">
            <input v-model="serving" type="radio" :value="TEAMS.US" data-field="serving-us" />
            Мы
          </label>
          <label class="segmented__option">
            <input v-model="serving" type="radio" :value="TEAMS.THEM" data-field="serving-them" />
            Соперник
          </label>
        </div>
      </fieldset>

      <fieldset class="field">
        <legend class="field__label">Правила замен</legend>
        <div class="segmented">
          <label class="segmented__option">
            <input
              v-model="substitutionMode"
              type="radio"
              :value="SUBSTITUTION_MODES.COUNT"
              data-field="substitution-count"
            />
            Только количество
          </label>
          <label class="segmented__option">
            <input
              v-model="substitutionMode"
              type="radio"
              :value="SUBSTITUTION_MODES.FIVB"
              data-field="substitution-fivb"
            />
            По правилам FIVB
          </label>
        </div>
        <p class="hint">
          В упрощённом режиме проверяется только лимит. Замены либеро в обоих режимах — по правилам
          FIVB.
        </p>
      </fieldset>

      <div v-if="!rosterReady" class="setup-warning" data-field="roster-warning" role="alert">
        <p>Сначала настройте состав и стартовую шестёрку — заполните все шесть зон.</p>
        <button
          type="button"
          class="button-secondary"
          data-action="to-lineup"
          @click="router.push({ name: 'lineup' })"
        >
          К расстановке
        </button>
      </div>

      <button
        type="submit"
        class="button-block"
        :disabled="!teamName.trim() || !opponent.trim() || !rosterReady"
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
  gap: 20px;
  padding: 16px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 0;
  border: 0;
}

.field__label {
  padding: 0;
  color: var(--ink-soft);
  font-size: 0.78rem;
  font-weight: 650;
  letter-spacing: 0.01em;
}

.field input[type='text'] {
  width: 100%;
}

.hint {
  color: var(--ink-soft);
  font-size: 0.82rem;
  line-height: 1.45;
}

.setup-warning {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border: 1px solid #efc9c5;
  border-left: 3px solid var(--danger);
  border-radius: 10px;
  background: var(--danger-bg);
  color: var(--danger);
  font-size: 0.9rem;
}

.setup-warning .button-secondary {
  align-self: flex-start;
}

.button-block {
  width: 100%;
}
</style>
