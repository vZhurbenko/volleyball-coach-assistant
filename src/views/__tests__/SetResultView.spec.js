import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { saveMatch } from '../../storage.js'
import SetResultView from '../SetResultView.vue'

const LINEUP = defaultLineup(TEAM_ROSTER)
const SET_START = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.US }

const point = (team) => ({ type: EVENT_TYPES.POINT, team })
const points = (team, count) => Array.from({ length: count }, () => point(team))

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function saveSetOver(storage) {
  saveMatch(
    {
      events: [SET_START, ...points(TEAMS.THEM, 2), ...points(TEAMS.US, 25)],
      settings: {
        teamName: 'Наши',
        opponent: 'Динамо',
        lineup: LINEUP,
        serving: TEAMS.US,
        substitutionMode: 'count',
      },
    },
    storage,
  )
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/set-result', name: 'set-result', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/set-result')
  await router.isReady()

  const wrapper = mount(SetResultView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router }
}

let storage

beforeEach(() => {
  storage = fakeStorage()
  saveSetOver(storage)
})

describe('SetResultView', () => {
  it('renders the set result and every point', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.text()).toContain('Партия 1 завершена')
    expect(wrapper.text()).toContain('Победитель: Наши')
    expect(wrapper.text()).toContain('25:2')
    expect(wrapper.findAll('[data-point-row]')).toHaveLength(27)
  })

  it('colors the scoring numbers by team', async () => {
    const { wrapper } = await mountView()

    const rows = wrapper.findAll('[data-point-row]')
    // Первые два очка — соперника; победитель (мы) в первой колонке.
    expect(rows[0].findAll('td')[1].classes()).toContain('point-log__score--them')
    expect(rows[2].findAll('td')[0].classes()).toContain('point-log__score--us')
  })

  it('goes to the lineup', async () => {
    const { wrapper, router } = await mountView()

    await wrapper.get('[data-action="to-lineup"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('lineup')
  })
})
