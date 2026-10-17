<script setup>
import { computed, nextTick, ref } from 'vue'

import { storeToRefs } from 'pinia'
import { useRouter } from 'vue-router'

import LineupCourt from '../components/LineupCourt.vue'
import LineupPlayerDialog from '../components/LineupPlayerDialog.vue'
import { COURT_ROLES, ROLE_LABELS, ROLES } from '../domain/constants.js'
import { availablePlayersForZone } from '../domain/lineup.js'
import { useLineupStore } from '../stores/lineup.js'

const props = defineProps({
  /** Хранилище подменяется в тестах; в приложении — localStorage. */
  storage: { type: Object, default: undefined },
})

const router = useRouter()
const lineupStore = useLineupStore()
lineupStore.load(props.storage)
const { roster, lineup, validation } = storeToRefs(lineupStore)

const ROLE_OPTIONS = [...COURT_ROLES, ROLES.LIBERO]

const teamNameDraft = ref(lineupStore.defaultTeamName)

function saveTeamName() {
  lineupStore.setDefaultTeamName(teamNameDraft.value)
}

const pickingZone = ref(null)
const dialogPlayers = computed(() =>
  pickingZone.value === null
    ? roster.value
    : availablePlayersForZone(lineup.value, roster.value, pickingZone.value),
)

function assign({ playerId, role }) {
  lineupStore.assignDefault(pickingZone.value, { playerId, role })
  pickingZone.value = null
}

const draft = ref(null)
const editingId = ref(null)
const formViolations = ref([])
const formEl = ref(null)
const isEditing = computed(() => editingId.value !== null)

function revealForm() {
  nextTick(() => formEl.value?.scrollIntoView?.({ block: 'nearest' }))
}

function startAdd() {
  editingId.value = null
  formViolations.value = []
  draft.value = { number: '', firstName: '', lastName: '', role: '' }
  revealForm()
}

function startEdit(player) {
  editingId.value = player.id
  formViolations.value = []
  draft.value = {
    number: player.number,
    firstName: player.firstName,
    lastName: player.lastName,
    role: player.role,
  }
  revealForm()
}

function cancelForm() {
  draft.value = null
  editingId.value = null
  formViolations.value = []
}

function submitForm() {
  const result = editingId.value
    ? lineupStore.updatePlayer(editingId.value, draft.value)
    : lineupStore.addPlayer(draft.value)

  if (!result.ok) {
    formViolations.value = result.violations
    return
  }

  cancelForm()
}

function removePlayer(player) {
  lineupStore.removePlayer(player.id)
  if (editingId.value === player.id) cancelForm()
}

const jsonText = ref('')
const importStatus = ref('')
const importFailed = ref(false)
const jsonArea = ref(null)

async function exportRoster() {
  jsonText.value = JSON.stringify(lineupStore.exportSettings(), null, 2)
  importStatus.value = 'JSON готов — скопируйте текст.'
  importFailed.value = false

  await nextTick()
  jsonArea.value?.focus()
  jsonArea.value?.select()
}

function importRoster() {
  let parsed
  try {
    parsed = JSON.parse(jsonText.value)
  } catch {
    importStatus.value = 'Не удалось разобрать JSON'
    importFailed.value = true
    return
  }

  // Допускаем и голый массив игроков: так JSON проще собрать руками.
  const settings = Array.isArray(parsed) ? { players: parsed } : parsed
  const result = lineupStore.replaceSettings(settings)

  if (!result.ok) {
    importStatus.value = result.violations[0]?.message ?? 'Не удалось прочитать состав'
    importFailed.value = true
    return
  }

  cancelForm()
  teamNameDraft.value = lineupStore.defaultTeamName
  importStatus.value = `Состав заменён: игроков — ${roster.value.length}.`
  importFailed.value = false
}
</script>

<template>
  <section class="screen roster">
    <h1>Настройки команды</h1>
    <p class="hint">
      Менять состав можно до начала первой партии. Изменения сохраняются на этом устройстве сразу.
    </p>

    <section class="board board--pad roster__board" data-field="team-settings">
      <h2>Наша команда</h2>
      <label class="field">
        <span class="field__label">Название по умолчанию</span>
        <input
          v-model="teamNameDraft"
          data-field="default-team-name"
          type="text"
          autocomplete="off"
          placeholder="Название команды"
          @change="saveTeamName"
        />
      </label>
      <p class="hint">
        Подставляется в настройках игры. При фокусе подставленное название выделяется — можно сразу
        печатать своё.
      </p>
    </section>

    <section class="board board--pad roster__board" data-field="roster-editor">
      <div class="section-head">
        <h2>Игроки</h2>
        <button v-if="!draft" type="button" data-action="add-player" @click="startAdd">
          Добавить игрока
        </button>
      </div>

      <ul class="roster-list">
        <li
          v-for="player in roster"
          :key="player.id"
          class="roster-row"
          :data-roster-player="player.id"
        >
          <span class="roster-row__number">{{ player.number }}</span>
          <span class="roster-row__name">{{ player.firstName }} {{ player.lastName }}</span>
          <span class="roster-row__role">{{ ROLE_LABELS[player.role] }}</span>
          <div class="roster-row__actions">
            <button
              type="button"
              class="button-secondary button-compact"
              data-action="edit-player"
              :aria-label="`Изменить: ${player.firstName} ${player.lastName}`"
              @click="startEdit(player)"
            >
              Изменить
            </button>
            <button
              type="button"
              class="button-danger button-compact"
              data-action="remove-player"
              :aria-label="`Убрать: ${player.firstName} ${player.lastName}`"
              @click="removePlayer(player)"
            >
              Убрать
            </button>
          </div>
        </li>
      </ul>

      <p v-if="!roster.length" class="hint">В составе пока нет игроков.</p>

      <form
        v-if="draft"
        ref="formEl"
        class="player-form"
        data-field="player-form"
        @submit.prevent="submitForm"
      >
        <h3>{{ isEditing ? 'Изменить игрока' : 'Новый игрок' }}</h3>

        <div class="player-form__grid">
          <label class="field">
            <span class="field__label">Номер</span>
            <input
              v-model="draft.number"
              type="number"
              min="1"
              max="99"
              step="1"
              inputmode="numeric"
              autocomplete="off"
              data-field="player-number"
            />
          </label>
          <label class="field">
            <span class="field__label">Имя</span>
            <input
              v-model="draft.firstName"
              type="text"
              autocomplete="off"
              data-field="player-first-name"
            />
          </label>
          <label class="field">
            <span class="field__label">Фамилия</span>
            <input
              v-model="draft.lastName"
              type="text"
              autocomplete="off"
              data-field="player-last-name"
            />
          </label>
          <label class="field">
            <span class="field__label">Роль</span>
            <select v-model="draft.role" data-field="player-role">
              <option value="">Выберите роль</option>
              <option v-for="role in ROLE_OPTIONS" :key="role" :value="role">
                {{ ROLE_LABELS[role] }}
              </option>
            </select>
          </label>
        </div>

        <ul v-if="formViolations.length" class="violations" role="alert">
          <li v-for="violation in formViolations" :key="violation.code">
            {{ violation.message }}
          </li>
        </ul>

        <div class="player-form__actions">
          <button type="submit" data-action="save-player">
            {{ isEditing ? 'Сохранить' : 'Добавить' }}
          </button>
          <button
            type="button"
            class="button-secondary"
            data-action="cancel-player"
            @click="cancelForm"
          >
            Отмена
          </button>
        </div>
      </form>
    </section>

    <section class="board board--pad roster__board" data-field="default-six-editor">
      <h2>Стартовая шестёрка</h2>
      <p class="hint">
        Нажмите на зону и выберите игрока. С этой расстановкой команда начнёт матч.
      </p>

      <LineupCourt :lineup="lineup" :roster="roster" @select="pickingZone = $event" />

      <ul v-if="!validation.valid" class="violations" role="alert">
        <li v-for="violation in validation.violations" :key="`${violation.code}-${violation.zone}`">
          {{ violation.message }}
        </li>
      </ul>
    </section>

    <section class="board board--pad roster__board" data-field="roster-transfer">
      <h2>Перенос состава</h2>
      <p class="hint">
        «Экспорт» покажет JSON в поле ниже — скопируйте его. Чтобы восстановить состав, вставьте JSON
        и нажмите «Применить»: он полностью заменит игроков и стартовую шестёрку.
      </p>

      <textarea
        ref="jsonArea"
        v-model="jsonText"
        class="transfer__json"
        data-field="roster-json"
        rows="8"
        spellcheck="false"
        autocomplete="off"
        placeholder="JSON состава"
      ></textarea>

      <div class="transfer__actions">
        <button
          type="button"
          class="button-secondary"
          data-action="export-roster"
          @click="exportRoster"
        >
          Экспорт JSON
        </button>
        <button type="button" data-action="import-roster" @click="importRoster">
          Применить JSON
        </button>
      </div>

      <p
        v-if="importStatus"
        class="hint"
        :class="{ 'hint--error': importFailed }"
        role="status"
      >
        {{ importStatus }}
      </p>
    </section>

    <button
      type="button"
      class="button-secondary roster__back"
      data-action="back-to-lineup"
      @click="router.push({ name: 'lineup' })"
    >
      К расстановке
    </button>

    <LineupPlayerDialog
      v-if="pickingZone !== null"
      :zone="pickingZone"
      :players="dialogPlayers"
      @assign="assign"
      @cancel="pickingZone = null"
    />
  </section>
</template>

<style scoped>
.roster {
  gap: 16px;
}

.roster__board {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 12px;
}

.roster-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  border-top: 1px solid var(--line);
  list-style: none;
}

.roster-row {
  display: grid;
  grid-template-areas:
    'number name role'
    'number actions actions';
  grid-template-columns: 32px minmax(0, 1fr) auto;
  align-items: center;
  gap: 2px 10px;
  padding: 8px 0;
  border-bottom: 1px solid var(--line);
}

.roster-row__number {
  grid-area: number;
  font-size: 1.1rem;
  font-weight: 800;
  font-variant-numeric: tabular-nums;
}

.roster-row__name {
  grid-area: name;
  overflow: hidden;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.roster-row__role {
  grid-area: role;
  color: var(--ink-soft);
  font-size: 0.8rem;
  text-align: right;
}

.roster-row__actions {
  display: flex;
  grid-area: actions;
  gap: 6px;
}

.button-compact {
  min-height: 32px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 0.78rem;
}

.player-form {
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}

.player-form h3 {
  font-size: 0.95rem;
}

.player-form__grid {
  display: grid;
  gap: 10px;
}

.player-form__actions,
.transfer__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.transfer__json {
  width: 100%;
  padding: 10px 12px;
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 0.78rem;
  line-height: 1.45;
  resize: vertical;
}

.hint--error {
  color: var(--danger);
}

.roster__back {
  width: 100%;
}

@media (min-width: 600px) {
  .roster-row {
    grid-template-areas: 'number name role actions';
    grid-template-columns: 40px minmax(0, 1fr) auto auto;
  }

  .roster-row__role {
    text-align: left;
  }

  .player-form__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
