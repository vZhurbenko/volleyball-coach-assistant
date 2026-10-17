import { isMatchOver } from '../domain/score.js'

/**
 * Экран, на который возвращает сохранённый матч.
 *
 * @param {import('../domain/match.js').MatchState | null} state
 * @returns {'lineup' | 'match' | 'summary'}
 */
export function resumeScreen(state) {
  if (!state) return 'lineup'

  return isMatchOver(state.score) ? 'summary' : 'match'
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

    /** `/summary` — только для законченного матча. */
    requireFinishedMatch() {
      const state = readMatchState()
      if (!state) return { name: 'lineup' }

      return isMatchOver(state.score) ? true : { name: 'match' }
    },
  }
}
