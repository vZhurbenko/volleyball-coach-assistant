import { createRouter, createWebHistory } from 'vue-router'

import { matchState } from '../domain/match.js'
import { loadMatch } from '../storage.js'
import { createGuards } from './guards.js'
import LineupView from '../views/LineupView.vue'
import SetupView from '../views/SetupView.vue'
import MatchView from '../views/MatchView.vue'
import SummaryView from '../views/SummaryView.vue'

/**
 * Собирает роутер приложения. История и хранилище передаются параметрами,
 * чтобы тесты не зависели от адресной строки и localStorage.
 *
 * Состояние матча читается на каждый переход: после перезагрузки страницы
 * в хранилище уже лежит сохранённый матч.
 *
 * @param {object} [options]
 * @param {import('vue-router').RouterHistory} [options.history]
 * @param {Storage} [options.storage] — по умолчанию localStorage
 */
export function createAppRouter({
  history = createWebHistory(import.meta.env.BASE_URL),
  storage,
} = {}) {
  const readMatchState = () => matchState(loadMatch(storage)?.events ?? [])
  const guards = createGuards(readMatchState)

  return createRouter({
    history,
    routes: [
      {
        path: '/',
        name: 'lineup',
        component: LineupView,
        beforeEnter: guards.resume,
        props: { storage },
      },
      {
        path: '/setup',
        name: 'setup',
        component: SetupView,
        props: { storage },
      },
      {
        path: '/match',
        name: 'match',
        component: MatchView,
        beforeEnter: guards.requireMatch,
        props: { storage },
      },
      {
        path: '/summary',
        name: 'summary',
        component: SummaryView,
        beforeEnter: guards.requireFinishedMatch,
      },
    ],
  })
}

export default createAppRouter()
