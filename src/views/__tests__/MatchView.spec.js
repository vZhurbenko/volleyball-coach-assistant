import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { STAT_LABELS, STAT_TYPES, countersForPlayer } from '../../domain/stats.js'
import { loadMatch, saveMatch } from '../../storage.js'
import MatchView from '../MatchView.vue'

const LINEUP = defaultLineup(TEAM_ROSTER)
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

function saveWith(events, settings = {}) {
  saveMatch(
    {
      events,
      settings: {
        teamName: 'Наши',
        opponent: 'Динамо',
        lineup: LINEUP,
        serving: TEAMS.US,
        ...settings,
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
    expect(textOf(wrapper, 'team-us')).toBe('Наши')
    expect(textOf(wrapper, 'team-them')).toBe('Динамо')
    expect(textOf(wrapper, 'streaks')).toContain('Наши +2')
    expect(textOf(wrapper, 'streaks')).toContain('Динамо +1')
  })

  it('shows the protocol court under the scoreboard', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    expect(wrapper.findAll('[data-zone]')).toHaveLength(6)
    expect(wrapper.get('[data-zone="1"]').attributes('data-player-id')).toBe('titov')
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

describe('MatchView player stats menu', () => {
  async function openMenu(wrapper, zone = 1) {
    await wrapper.get(`[data-zone="${zone}"]`).trigger('click')
  }

  it('shows the five facts for the tapped player', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    await openMenu(wrapper)

    const dialog = wrapper.get('[role="dialog"]')
    expect(dialog.text()).toContain('Титов')
    for (const label of Object.values(STAT_LABELS)) {
      expect(dialog.text()).toContain(label)
    }
  })

  it('writes every stat button to the journal and closes the menu', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    for (const statType of Object.values(STAT_TYPES)) {
      await openMenu(wrapper)
      await wrapper.get(`[data-stat="${statType}"]`).trigger('click')
      expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    }

    const saved = loadMatch(storage)
    const stats = saved.events.filter((event) => event.type === EVENT_TYPES.STAT)
    expect(stats.map((event) => event.statType)).toEqual(Object.values(STAT_TYPES))
    expect(stats.every((event) => event.playerId === 'titov')).toBe(true)

    const counters = countersForPlayer(matchState(saved.events).stats, 'titov')
    for (const statType of Object.values(STAT_TYPES)) {
      expect(counters[statType]).toBe(1)
    }
  })

  it('counts repeated presses', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    await openMenu(wrapper)
    await wrapper.get(`[data-stat="${STAT_TYPES.SERVE}"]`).trigger('click')
    await openMenu(wrapper)
    await wrapper.get(`[data-stat="${STAT_TYPES.SERVE}"]`).trigger('click')

    const counters = countersForPlayer(matchState(loadMatch(storage).events).stats, 'titov')
    expect(counters.serve).toBe(2)
  })

  it('closes without writing after cancel', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    await openMenu(wrapper)
    await wrapper.get('[data-action="close-menu"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(loadMatch(storage).events).toHaveLength(1)
  })
})

describe('MatchView substitutions', () => {
  async function openSubstitutions(wrapper) {
    await wrapper.get('[data-action="open-substitution"]').trigger('click')
  }

  async function selectPair(wrapper, outgoingId, incomingId) {
    await wrapper.get(`[data-sub-out="${outgoingId}"]`).trigger('click')
    await wrapper.get(`[data-sub-in="${incomingId}"]`).trigger('click')
  }

  it('makes a legal substitution and moves the player onto the court', async () => {
    saveWith([SET_START])
    const { wrapper } = await mountView()

    await openSubstitutions(wrapper)
    expect(wrapper.get('[data-field="substitutions-left"]').text()).toContain('6')

    await selectPair(wrapper, 'titov', 'gorobchenko')
    await wrapper.get('[data-action="confirm-substitution"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-zone="1"]').attributes('data-player-id')).toBe('gorobchenko')
    expect(loadMatch(storage).events.at(-1)).toEqual({
      type: EVENT_TYPES.SUBSTITUTION,
      outgoingId: 'titov',
      incomingId: 'gorobchenko',
      exceptional: false,
      mode: 'fivb',
    })

    await openSubstitutions(wrapper)
    expect(wrapper.get('[data-field="substitutions-left"]').text()).toContain('5')
  })

  it('blocks an illegal substitution and explains why', async () => {
    saveWith([
      SET_START,
      { type: EVENT_TYPES.SUBSTITUTION, outgoingId: 'titov', incomingId: 'gorobchenko' },
    ])
    const { wrapper } = await mountView()
    const before = loadMatch(storage).events.length

    await openSubstitutions(wrapper)
    // В слот 1 уже вышел запасной; вернуться туда может только Титов.
    await selectPair(wrapper, 'gorobchenko', 'emelyanov')

    expect(wrapper.get('[data-field="substitution-reason"]').text()).toContain('только стартовый')
    const confirm = wrapper.get('[data-action="confirm-substitution"]')
    expect(confirm.attributes('disabled')).toBeDefined()
    await confirm.trigger('click')

    expect(loadMatch(storage).events).toHaveLength(before)
    expect(wrapper.get('[data-zone="1"]').attributes('data-player-id')).toBe('gorobchenko')
  })

  it('makes an exceptional substitution and retires the outgoing player', async () => {
    saveWith([
      SET_START,
      { type: EVENT_TYPES.SUBSTITUTION, outgoingId: 'titov', incomingId: 'gorobchenko' },
    ])
    const { wrapper } = await mountView()

    await openSubstitutions(wrapper)
    await selectPair(wrapper, 'gorobchenko', 'emelyanov')
    expect(wrapper.find('[data-field="substitution-reason"]').exists()).toBe(true)

    await wrapper.get('[data-field="exceptional"]').setValue(true)

    expect(wrapper.find('[data-field="substitution-reason"]').exists()).toBe(false)
    await wrapper.get('[data-action="confirm-substitution"]').trigger('click')

    expect(wrapper.get('[data-zone="1"]').attributes('data-player-id')).toBe('emelyanov')

    const state = matchState(loadMatch(storage).events)
    expect(state.substitutions.retired).toContain('gorobchenko')
    expect(loadMatch(storage).events.at(-1)).toEqual({
      type: EVENT_TYPES.SUBSTITUTION,
      outgoingId: 'gorobchenko',
      incomingId: 'emelyanov',
      exceptional: true,
      mode: 'fivb',
    })

    // Исключительная замена лимит не расходует.
    await openSubstitutions(wrapper)
    expect(wrapper.get('[data-field="substitutions-left"]').text()).toContain('5')
  })

  it('ignores the pair rules in count-only mode', async () => {
    saveWith(
      [
        SET_START,
        { type: EVENT_TYPES.SUBSTITUTION, outgoingId: 'titov', incomingId: 'gorobchenko' },
      ],
      { substitutionMode: 'count' },
    )
    const { wrapper } = await mountView()

    await openSubstitutions(wrapper)
    expect(wrapper.find('[data-field="exceptional"]').exists()).toBe(false)

    // В FIVB так нельзя: вернуться на позицию может только Титов.
    await selectPair(wrapper, 'gorobchenko', 'emelyanov')
    expect(wrapper.find('[data-field="substitution-reason"]').exists()).toBe(false)

    await wrapper.get('[data-action="confirm-substitution"]').trigger('click')

    expect(wrapper.get('[data-zone="1"]').attributes('data-player-id')).toBe('emelyanov')
    expect(loadMatch(storage).events.at(-1)).toEqual({
      type: EVENT_TYPES.SUBSTITUTION,
      outgoingId: 'gorobchenko',
      incomingId: 'emelyanov',
      exceptional: false,
      mode: 'count',
    })
  })
})
