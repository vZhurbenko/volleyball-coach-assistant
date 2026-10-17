import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROLES } from '../../domain/constants.js'
import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { loadMatch, saveRosterSettings } from '../../storage.js'
import SetupView from '../SetupView.vue'

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/setup', name: 'setup', component: { template: '<div />' } },
      { path: '/match', name: 'match', component: { template: '<div />' } },
    ],
  })
}

/** Монтирует экран с чистым store, роутером и хранилищем. */
async function mountView(storage = fakeStorage()) {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/setup')
  await router.isReady()

  const wrapper = mount(SetupView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router, storage }
}

let storage

beforeEach(() => {
  storage = fakeStorage()
})

describe('SetupView', () => {
  it('renders the screen heading', async () => {
    const { wrapper } = await mountView(storage)

    expect(wrapper.text()).toContain('Настройка игры')
  })

  it('offers who serves first with us by default', async () => {
    const { wrapper } = await mountView(storage)

    expect(wrapper.get('[data-field="serving-us"]').element.checked).toBe(true)
    expect(wrapper.get('[data-field="serving-them"]').element.checked).toBe(false)
  })

  it('offers the count-only substitution rules by default', async () => {
    const { wrapper } = await mountView(storage)

    expect(wrapper.get('[data-field="substitution-count"]').element.checked).toBe(true)
    expect(wrapper.get('[data-field="substitution-fivb"]').element.checked).toBe(false)
  })

  it('does not start the game without an opponent', async () => {
    const { wrapper, router } = await mountView(storage)
    await wrapper.get('[data-field="team-name"]').setValue('Наши')
    await wrapper.get('[data-field="opponent"]').setValue('   ')

    expect(wrapper.get('[data-action="start"]').attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('setup')
    expect(loadMatch(storage)).toBeNull()
  })

  it('does not start the game without our team name', async () => {
    const { wrapper, router } = await mountView(storage)
    await wrapper.get('[data-field="opponent"]').setValue('Динамо')

    expect(wrapper.get('[data-action="start"]').attributes('disabled')).toBeDefined()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('setup')
    expect(loadMatch(storage)).toBeNull()
  })

  it('starts the game with the chosen settings', async () => {
    const { wrapper, router } = await mountView(storage)
    await wrapper.get('[data-field="team-name"]').setValue('Наши')
    await wrapper.get('[data-field="opponent"]').setValue('Динамо')
    await wrapper.get('[data-field="serving-them"]').setValue()

    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('match')

    const saved = loadMatch(storage)
    expect(saved.settings.teamName).toBe('Наши')
    expect(saved.settings.opponent).toBe('Динамо')
    expect(saved.settings.serving).toBe(TEAMS.THEM)
    expect(saved.settings.substitutionMode).toBe('count')
    expect(saved.settings.lineup).toEqual(defaultLineup(TEAM_ROSTER))

    expect(saved.events).toHaveLength(1)
    expect(saved.events[0]).toEqual({
      type: EVENT_TYPES.SET_START,
      lineup: defaultLineup(TEAM_ROSTER),
      serving: TEAMS.THEM,
    })
  })

  it('restores the saved settings after a reload', async () => {
    const first = await mountView(storage)
    await first.wrapper.get('[data-field="team-name"]').setValue('Наши')
    await first.wrapper.get('[data-field="opponent"]').setValue('Динамо')
    await first.wrapper.get('[data-field="serving-them"]').setValue()
    await first.wrapper.get('[data-field="substitution-fivb"]').setValue()
    await first.wrapper.get('form').trigger('submit')
    await flushPromises()

    // Перезагрузка: новый store и роутер, то же хранилище.
    const { wrapper } = await mountView(storage)

    expect(wrapper.get('[data-field="team-name"]').element.value).toBe('Наши')
    expect(wrapper.get('[data-field="opponent"]').element.value).toBe('Динамо')
    expect(wrapper.get('[data-field="serving-them"]').element.checked).toBe(true)
    expect(wrapper.get('[data-field="substitution-fivb"]').element.checked).toBe(true)
  })

  it('starts the match with the stored default six', async () => {
    const storedSix = {
      ...defaultLineup(TEAM_ROSTER),
      zones: {
        ...defaultLineup(TEAM_ROSTER).zones,
        1: { playerId: 'fatkulin', role: ROLES.SETTER },
      },
    }
    saveRosterSettings({ players: TEAM_ROSTER, defaultLineup: storedSix }, storage)

    const { wrapper } = await mountView(storage)
    await wrapper.get('[data-field="team-name"]').setValue('Наши')
    await wrapper.get('[data-field="opponent"]').setValue('Динамо')
    await wrapper.get('form').trigger('submit')
    await flushPromises()

    expect(loadMatch(storage).events[0].lineup.zones[1]).toEqual({
      playerId: 'fatkulin',
      role: ROLES.SETTER,
    })
  })
})
