import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { MOCK_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { loadMatch, saveMatch } from '../../storage.js'
import MatchView from '../MatchView.vue'

const LINEUP = defaultLineup(MOCK_ROSTER)
const SET_START = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.US }

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function points(team, count) {
  return Array.from({ length: count }, () => ({ type: EVENT_TYPES.POINT, team }))
}

function saveWith(events) {
  saveMatch({ events, settings: { opponent: 'Динамо', lineup: LINEUP, serving: TEAMS.US } }, storage)
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/match', name: 'match', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/match')
  await router.isReady()

  const wrapper = mount(MatchView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router }
}

function textOf(wrapper, field) {
  return wrapper.get(`[data-field="${field}"]`).text()
}

let storage

beforeEach(() => {
  storage = fakeStorage()
})

describe('MatchView scoreboard', () => {
  it('renders the score and the point streaks from the journal', async () => {
    saveWith([SET_START, ...points(TEAMS.US, 2), ...points(TEAMS.THEM, 1)])
    const { wrapper } = await mountView()

    expect(textOf(wrapper, 'points-us')).toBe('2')
    expect(textOf(wrapper, 'points-them')).toBe('1')
    expect(textOf(wrapper, 'team-them')).toBe('Динамо')
    expect(textOf(wrapper, 'streaks')).toContain('Мы +2')
    expect(textOf(wrapper, 'streaks')).toContain('Динамо +1')
  })

  it('adds a point to the tapped side and saves it', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    await wrapper.get('[data-side="them"]').trigger('click')

    expect(textOf(wrapper, 'points-them')).toBe('1')
    expect(loadMatch(storage).events.at(-1)).toEqual({ type: EVENT_TYPES.POINT, team: TEAMS.THEM })
  })

  it('highlights the serving team and moves the highlight with the point', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    expect(textOf(wrapper, 'serve-us')).toBe('подача')
    expect(textOf(wrapper, 'serve-them')).toBe('')

    await wrapper.get('[data-side="them"]').trigger('click')

    expect(textOf(wrapper, 'serve-us')).toBe('')
    expect(textOf(wrapper, 'serve-them')).toBe('подача')
  })

  it('undoes the last point together with its serve consequence', async () => {
    saveWith([SET_START, ...points(TEAMS.US, 1), ...points(TEAMS.THEM, 1)])
    const { wrapper } = await mountView()
    expect(textOf(wrapper, 'serve-them')).toBe('подача')

    await wrapper.get('[data-action="undo"]').trigger('click')

    expect(textOf(wrapper, 'points-them')).toBe('0')
    expect(textOf(wrapper, 'serve-us')).toBe('подача')
    expect(loadMatch(storage).events).toHaveLength(2)
  })

  it('reopens a finished set when its last point is undone', async () => {
    saveWith([SET_START, ...points(TEAMS.US, 24)])
    const { wrapper } = await mountView()

    await wrapper.get('[data-side="us"]').trigger('click')
    expect(textOf(wrapper, 'points-us')).toBe('25')

    // Партия закрыта — очки больше не начисляются.
    await wrapper.get('[data-side="us"]').trigger('click')
    expect(textOf(wrapper, 'points-us')).toBe('25')

    await wrapper.get('[data-action="undo"]').trigger('click')
    expect(textOf(wrapper, 'points-us')).toBe('24')

    // Партия снова в игре.
    await wrapper.get('[data-side="us"]').trigger('click')
    expect(textOf(wrapper, 'points-us')).toBe('25')
  })

  it('asks for confirmation before resetting and can be cancelled', async () => {
    saveWith([SET_START, ...points(TEAMS.US, 2)])
    const { wrapper } = await mountView()

    await wrapper.get('[data-action="reset"]').trigger('click')
    expect(wrapper.get('[data-action="confirm-reset"]').exists()).toBe(true)

    await wrapper.get('[data-action="cancel-reset"]').trigger('click')

    expect(wrapper.find('[data-action="confirm-reset"]').exists()).toBe(false)
    expect(textOf(wrapper, 'points-us')).toBe('2')
    expect(loadMatch(storage)).not.toBeNull()
  })

  it('clears the match and returns to the lineup on confirmed reset', async () => {
    saveWith([SET_START, ...points(TEAMS.US, 2)])
    const { wrapper, router } = await mountView()

    await wrapper.get('[data-action="reset"]').trigger('click')
    await wrapper.get('[data-action="confirm-reset"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('lineup')
    expect(loadMatch(storage)).toBeNull()
  })
})
