import { currentSet, isMatchOver, isSetOver } from '../domain/score.js'

/**
 * Экран, на который возвращает сохранённый матч. Между партиями тренер
 * возвращается к расстановке, чтобы собрать шестёрку на следующую партию.
 *
 * @param {import('../domain/match.js').MatchState | null} state
 * @returns {'lineup' | 'match' | 'summary'}
 */
export function resumeScreen(state) {
  if (!state) return 'lineup'
  if (isMatchOver(state.score)) return 'summary'
  if (isSetOver(currentSet(state.score))) return 'lineup'

  return 'match'
}

/**
 * Гварды маршрутов. Состояние матча читается при каждом переходе: после
 * перезагрузки в хранилище уже другой матч, и решение может измениться.
 *
 * @param {() => import('../domain/match.js').MatchState | null} readMatchState
 */
export function createGuards(readMatchState) {
  return {
    /** `/` — возвращает на актуальный экран, если матч уже идёт. */
    resume(to) {
      const target = resumeScreen(readMatchState())
      return to.name === target ? true : { name: target }
    },

    /** `/match` — только для начатого матча. */
    requireMatch() {
      return readMatchState() ? true : { name: 'lineup' }
    },

    /** `/set-result` — только между партиями. */
    requireSetResult() {
      const state = readMatchState()
      if (!state) return { name: 'lineup' }
      if (isMatchOver(state.score)) return { name: 'summary' }
      if (!isSetOver(currentSet(state.score))) return { name: 'match' }

      return true
    },

    /** `/roster` — состав и стартовая шестёрка редактируются только до матча. */
    requireNoMatch() {
      const state = readMatchState()
      return state ? { name: resumeScreen(state) } : true
    },

    /** `/summary` — только для законченного матча. */
    requireFinishedMatch() {
      const state = readMatchState()
      if (!state) return { name: 'lineup' }

      return isMatchOver(state.score) ? true : { name: 'match' }
    },
  }
}
