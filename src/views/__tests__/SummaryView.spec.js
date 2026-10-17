import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { STAT_TYPES } from '../../domain/stats.js'
import { loadMatch, saveMatch, saveRosterSettings } from '../../storage.js'
import SummaryView from '../SummaryView.vue'

const LINEUP = defaultLineup(TEAM_ROSTER)

const point = (team) => ({ type: EVENT_TYPES.POINT, team })
const setStart = (serving) => ({ type: EVENT_TYPES.SET_START, lineup: LINEUP, serving })
const stat = (playerId, statType) => ({ type: EVENT_TYPES.STAT, playerId, statType })

/** Партия с заданным счётом; очки чередуются, чтобы партия не закрылась раньше времени. */
function playedSet({ serving, us, them, stats = [], prefix = [] }) {
  const events = [setStart(serving), ...prefix, ...stats]
  let u = 0
  let t = 0

  while (u < us || t < them) {
    if (u < us) {
      events.push(point(TEAMS.US))
      u += 1
    }
    if (t < them) {
      events.push(point(TEAMS.THEM))
      t += 1
    }
  }

  return events
}

function finishedMatch() {
  return [
    ...playedSet({
      serving: TEAMS.US,
      us: 25,
      them: 10,
      stats: [stat('titov', STAT_TYPES.POINT), stat('gromov', STAT_TYPES.BLOCK)],
    }),
    ...playedSet({
      serving: TEAMS.THEM,
      us: 20,
      them: 25,
      stats: [stat('titov', STAT_TYPES.SERVE)],
    }),
    ...playedSet({ serving: TEAMS.US, us: 25, them: 15 }),
    ...playedSet({ serving: TEAMS.THEM, us: 25, them: 20 }),
  ]
}

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function saveFinished(storage, events = finishedMatch()) {
  saveMatch(
    {
      events,
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
      { path: '/summary', name: 'summary', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/summary')
  await router.isReady()

  const wrapper = mount(SummaryView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router }
}

let storage

beforeEach(() => {
  storage = fakeStorage()
  saveFinished(storage)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SummaryView', () => {
  it('renders the match result and the set scores', async () => {
    const { wrapper } = await mountView()

    const result = wrapper.get('[data-field="match-result"]')
    expect(result.text()).toContain('Наши')
    expect(result.text()).toContain('Динамо')
    expect(result.text()).toContain('3:1')

    expect(wrapper.get('[data-set="1"]').text()).toContain('25:10')
    expect(wrapper.get('[data-set="2"]').text()).toContain('20:25')
    expect(wrapper.get('[data-set="4"]').text()).toContain('25:20')
  })

  it('renders the stats by set and for the whole match', async () => {
    const { wrapper } = await mountView()

    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat="point"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="gromov"] [data-stat="block"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="2"] [data-stat-player="titov"] [data-stat="serve"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat="serve"]').text(),
    ).toBe('0')

    expect(wrapper.get('[data-total-player="titov"] [data-stat="point"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="titov"] [data-stat="serve"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="gromov"] [data-stat="block"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="zhurbenko"] [data-stat="point"]').text()).toBe('0')
  })

  it('renders the point log for every set', async () => {
    const { wrapper } = await mountView()

    const logs = wrapper.findAll('[data-field="point-log"]')
    expect(logs).toHaveLength(4)
    expect(logs[0].text()).toContain('Наши')
    expect(logs[0].text()).toContain('Динамо')

    // Мы всегда слева, даже если партию выиграл соперник.
    expect(logs[1].text().indexOf('Наши')).toBeLessThan(logs[1].text().indexOf('Динамо'))
  })

  it('marks the exceptional substitutions and the retired players', async () => {
    saveFinished(storage, [
      ...playedSet({
        serving: TEAMS.US,
        us: 25,
        them: 10,
        prefix: [
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'titov',
            incomingId: 'gorobchenko',
          },
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'gorobchenko',
            incomingId: 'emelyanov',
            exceptional: true,
          },
        ],
      }),
      ...playedSet({ serving: TEAMS.THEM, us: 20, them: 25 }),
      ...playedSet({ serving: TEAMS.US, us: 25, them: 15 }),
      ...playedSet({ serving: TEAMS.THEM, us: 25, them: 20 }),
    ])

    const { wrapper } = await mountView()

    expect(wrapper.get('[data-field="retired"]').text()).toContain('Горобченко')
    const exceptional = wrapper.get('[data-field="exceptional-substitutions"]')
    expect(exceptional.text()).toContain('Горобченко')
    expect(exceptional.text()).toContain('Емельянов')
  })

  it('prints the summary', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const { wrapper } = await mountView()

    await wrapper.get('[data-action="print"]').trigger('click')

    expect(print).toHaveBeenCalled()
    expect(wrapper.get('[data-action="print"]').classes()).toContain('no-print')
    expect(wrapper.get('[data-action="new-game"]').classes()).toContain('no-print')
  })

  it('has print styles', () => {
    const css = readFileSync(resolve(cwd(), 'src/assets/main.css'), 'utf8')

    expect(css).toContain('@media print')
    expect(css).toContain('.no-print')
  })

  it('starts a new game and returns to the lineup', async () => {
    const { wrapper, router } = await mountView()

    await wrapper.get('[data-action="new-game"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('lineup')
    expect(loadMatch(storage)).toBeNull()
  })

  it('uses the roster from storage in the totals', async () => {
    const players = TEAM_ROSTER.map((player) =>
      player.id === 'titov' ? { ...player, lastName: 'Титов-младший' } : player,
    )
    saveRosterSettings({ players, defaultLineup: LINEUP }, storage)

    const { wrapper } = await mountView()

    expect(wrapper.get('[data-total-player="titov"]').text()).toContain('Титов-младший')
  })
})
