import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { EVENT_TYPES, matchState, undoLastPoint } from '../domain/match.js'
import { currentSet, isMatchOver, isSetOver } from '../domain/score.js'
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

  return { events, settings, state, canUndo, load, addPoint, undo, reset }
})
