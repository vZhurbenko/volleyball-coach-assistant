import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { EVENT_TYPES, matchState, undoLastPoint } from '../domain/match.js'
import { currentSet, isMatchOver, isSetOver } from '../domain/score.js'
import {
  SUBSTITUTION_MODES,
  substitute,
  substitutionsLeft as countSubstitutionsLeft,
} from '../domain/substitutions.js'
import { clearMatch, loadMatch, saveMatch } from '../storage.js'

/**
 * Текущий матч: журнал событий и сохранённые настройки.
 *
 * Состояние не хранится отдельно — оно каждый раз собирается из журнала
 * редьюсером, поэтому отмена очка сама откатывает подачу, ротацию и либеро.
 * Каждое изменение сразу пишется в хранилище: перезагрузка не теряет матч.
 */
export const useMatchStore = defineStore('match', () => {
  const events = ref([])
  const settings = ref({})
  let storage

  const state = computed(() => matchState(events.value))
  const canUndo = computed(() => (state.value?.history.length ?? 0) > 0)
  const substitutionsLeft = computed(() =>
    state.value ? countSubstitutionsLeft(state.value.substitutions) : 0,
  )
  const substitutionMode = computed(
    () => settings.value.substitutionMode ?? SUBSTITUTION_MODES.FIVB,
  )
  const canScore = computed(() => {
    if (!state.value) return false

    return !isMatchOver(state.value.score) && !isSetOver(currentSet(state.value.score))
  })

  /**
   * Читает матч из хранилища. Вызывается экраном при входе — так же после
   * перезагрузки страницы.
   *
   * @param {Storage} [targetStorage] — по умолчанию localStorage
   */
  function load(targetStorage) {
    storage = targetStorage
    const saved = loadMatch(storage)
    events.value = saved?.events ?? []
    settings.value = saved?.settings ?? {}
  }

  /** @param {'us' | 'them'} team */
  function addPoint(team) {
    if (!canScore.value) return

    events.value = [...events.value, { type: EVENT_TYPES.POINT, team }]
    persist()
  }

  /**
   * @param {string} playerId
   * @param {string} statType — один из `STAT_TYPES`
   */
  function addStat(playerId, statType) {
    if (!state.value) return

    events.value = [...events.value, { type: EVENT_TYPES.STAT, playerId, statType }]
    persist()
  }

  /**
   * @param {{ outgoingId: string, incomingId: string, exceptional?: boolean }} request
   */
  function addSubstitution({ outgoingId, incomingId, exceptional = false }) {
    if (!state.value) {
      return { ok: false, reason: { code: 'NO_MATCH', message: 'Матч не начат' } }
    }

    const mode = substitutionMode.value
    const result = substitute(state.value.substitutions, {
      outgoingId,
      incomingId,
      exceptional,
      mode,
    })
    if (!result.ok) return result

    events.value = [
      ...events.value,
      { type: EVENT_TYPES.SUBSTITUTION, outgoingId, incomingId, exceptional, mode },
    ]
    persist()
    return result
  }

  function undo() {
    const next = undoLastPoint(events.value)
    if (next === events.value) return

    events.value = next
    persist()
  }

  function reset() {
    events.value = []
    settings.value = {}
    clearMatch(storage)
  }

  function persist() {
    saveMatch({ events: events.value, settings: settings.value }, storage)
  }

  return {
    events,
    settings,
    state,
    canUndo,
    substitutionsLeft,
    substitutionMode,
    load,
    addPoint,
    addStat,
    addSubstitution,
    undo,
    reset,
  }
})
