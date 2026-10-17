import { beforeEach, describe, expect, it } from 'vitest'

import { Fragment } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROLES } from '../../domain/constants.js'
import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/__tests__/fixtures/team-roster.js'
import { TEAMS } from '../../domain/score.js'
import { STAT_TYPES, countersForSet } from '../../domain/stats.js'
import { loadMatch, saveMatch } from '../../storage.js'
import { useLineupStore } from '../../stores/lineup.js'
import LineupView from '../LineupView.vue'

const LIBERO = {
  id: 'test-libero',
  firstName: 'Илья',
  lastName: 'Тестов',
  number: 99,
  role: ROLES.LIBERO,
}

const ROSTER_WITH_LIBERO = [...TEAM_ROSTER, LIBERO]

const DEFAULT_LINEUP = defaultLineup(TEAM_ROSTER)

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function saveWith(storage, events) {
  saveMatch(
    {
      events,
      settings: {
        teamName: 'Наши',
        opponent: 'Динамо',
        lineup: DEFAULT_LINEUP,
        serving: TEAMS.US,
        substitutionMode: 'count',
      },
    },
    storage,
  )
}

const setStart = (lineup = DEFAULT_LINEUP, serving = TEAMS.US) => ({
  type: EVENT_TYPES.SET_START,
  lineup,
  serving,
})
const points = (team, count) =>
  Array.from({ length: count }, () => ({ type: EVENT_TYPES.POINT, team }))

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/setup', name: 'setup', component: { template: '<div />' } },
      { path: '/roster', name: 'roster', component: { template: '<div />' } },
      { path: '/match', name: 'match', component: { template: '<div />' } },
    ],
  })
}

/** Монтирует экран с чистым store и роутером — как в приложении. */
async function mountView(roster = TEAM_ROSTER, storage = fakeStorage()) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLineupStore().init(roster)

  const router = testRouter()
  await router.push('/')
  await router.isReady()

  const wrapper = mount(LineupView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })
  return { wrapper, router, storage }
}

/** Открывает список игроков для зоны. */
async function openZone(wrapper, zone) {
  await wrapper.get(`[data-zone="${zone}"]`).trigger('click')
}

/** Выбирает игрока в открытом диалоге. */
async function pickPlayer(wrapper, playerId) {
  await wrapper.get(`[data-player-id="${playerId}"]`).trigger('click')
}

/** Подтверждает роль в диалоге назначения. */
async function pickRole(wrapper, role) {
  await wrapper.get(`[data-role="${role}"]`).trigger('click')
}

async function assign(wrapper, zone, playerId, role) {
  await openZone(wrapper, zone)
  await pickPlayer(wrapper, playerId)
  await pickRole(wrapper, role)
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('LineupView', () => {
  it('renders the screen heading', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.text()).toContain('Расстановка')
  })

  it('opens the roster settings before the match', async () => {
    const { wrapper, router } = await mountView()

    const button = wrapper.get('[data-action="edit-roster"]')
    expect(button.text()).toContain('Настроить состав')

    await button.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('roster')
  })

  it('renders a single root element for the screen transition', async () => {
    // <Transition> в App не умеет анимировать фрагмент: у экрана должен быть один корень.
    const { wrapper } = await mountView()

    expect(wrapper.getCurrentComponent().subTree.type).not.toBe(Fragment)
  })

  it('prefills the starting six from the team roster', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.get('[data-zone="1"]').text()).toContain('Титов')
    expect(wrapper.get('[data-zone="3"]').text()).toContain('Громов')
    expect(wrapper.get('[data-zone="4"]').text()).toContain('Панчишкина')
    expect(wrapper.text()).not.toContain('Назначить')
  })

  it('assigns a player to a zone', async () => {
    const { wrapper } = await mountView()

    await assign(wrapper, 4, 'fatkulin', ROLES.SETTER)

    const zone = wrapper.get('[data-zone="4"]')
    expect(zone.text()).toContain('Фаткулин')
    expect(zone.text()).toContain('Связка')
    expect(zone.text()).not.toContain('Панчишкина')
  })

  it('offers only players not assigned to other zones', async () => {
    const { wrapper } = await mountView()

    await openZone(wrapper, 4)

    const ids = wrapper.findAll('[data-player-id]').map((item) => item.attributes('data-player-id'))
    // Все, кто стоит в других зонах, недоступны.
    expect(ids).not.toContain('titov')
    expect(ids).not.toContain('gromov')
    expect(ids).not.toContain('abroskin')
    // Игрок этой зоны остаётся — ему можно сменить роль.
    expect(ids).toContain('panchishkina')
    expect(ids).toContain('fatkulin')
  })

  it('lets the coach override the role on assignment', async () => {
    const { wrapper } = await mountView()

    // Горобченко по составу диагональный, но назначаем его связкой.
    await assign(wrapper, 1, 'gorobchenko', ROLES.SETTER)

    const zone = wrapper.get('[data-zone="1"]')
    expect(zone.text()).toContain('Горобченко')
    expect(zone.text()).toContain('Связка')
    expect(zone.text()).not.toContain('Диагональный')
  })

  it('replaces the player when a filled zone is assigned again', async () => {
    const { wrapper } = await mountView()

    await assign(wrapper, 1, 'gorobchenko', ROLES.OPPOSITE)

    const zone = wrapper.get('[data-zone="1"]')
    expect(zone.text()).toContain('Горобченко')
    expect(zone.text()).not.toContain('Титов')
  })

  it('closes the dialog without changing the zone on cancel', async () => {
    const { wrapper } = await mountView()
    await openZone(wrapper, 2)

    await wrapper.get('[data-action="cancel"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-zone="2"]').text()).toContain('Верженовский')
  })

  it('blocks the next step and explains an invalid lineup', async () => {
    const { wrapper, router } = await mountView()

    // Титов становится третьим центральным блокирующим.
    await assign(wrapper, 1, 'titov', ROLES.MIDDLE_BLOCKER)

    expect(wrapper.get('[role="alert"]').text()).toContain('больше двух центральных блокирующих')
    const next = wrapper.get('[data-action="next"]')
    expect(next.attributes('disabled')).toBeDefined()

    await next.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('lineup')
  })

  it('goes to the setup screen on a valid lineup', async () => {
    const { wrapper, router } = await mountView()

    const next = wrapper.get('[data-action="next"]')
    expect(next.attributes('disabled')).toBeUndefined()

    await next.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.name).toBe('setup')
  })

  it('offers no libero when the team has none', async () => {
    const { wrapper } = await mountView()

    const options = wrapper.get('[data-field="libero"]').findAll('option')

    expect(options.map((option) => option.text())).toEqual(['Без либеро'])
  })

  it('offers only libero players as libero', async () => {
    const { wrapper } = await mountView(ROSTER_WITH_LIBERO)

    const options = wrapper.get('[data-field="libero"]').findAll('option')

    expect(options.map((option) => option.text())).toEqual(['Без либеро', '99 · Илья Тестов'])
  })

  it('selects and removes the libero', async () => {
    const { wrapper } = await mountView(ROSTER_WITH_LIBERO)
    const select = wrapper.get('[data-field="libero"]')

    expect(wrapper.text()).toContain('Либеро не выбран')

    await select.setValue('test-libero')
    expect(wrapper.text()).toContain('Либеро: Илья Тестов')

    await select.setValue('')
    expect(wrapper.text()).toContain('Либеро не выбран')
  })
})

describe('LineupView between sets', () => {
  it('hides the roster settings once the match has started', async () => {
    const storage = fakeStorage()
    saveWith(storage, [setStart(DEFAULT_LINEUP, TEAMS.US), ...points(TEAMS.US, 25)])

    const { wrapper } = await mountView(TEAM_ROSTER, storage)

    expect(wrapper.find('[data-action="edit-roster"]').exists()).toBe(false)
  })

  it('starts the next set with the FIVB serving team', async () => {
    const storage = fakeStorage()
    saveWith(storage, [
      setStart(DEFAULT_LINEUP, TEAMS.US),
      { type: EVENT_TYPES.STAT, playerId: 'titov', statType: STAT_TYPES.POINT },
      ...points(TEAMS.US, 25),
    ])
    const { wrapper, router } = await mountView(TEAM_ROSTER, storage)

    expect(wrapper.get('[data-field="next-serving"]').text()).toContain('Динамо')

    await wrapper.get('[data-action="start-next-set"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('match')

    const events = loadMatch(storage).events
    expect(events.at(-1)).toEqual({
      type: EVENT_TYPES.SET_START,
      lineup: DEFAULT_LINEUP,
      serving: TEAMS.THEM,
    })

    const state = matchState(events)
    expect(state.setNumber).toBe(2)
    expect(countersForSet(state.stats, 1).titov.point).toBe(1)
    expect(countersForSet(state.stats, 2)).toEqual({})
  })

  it('prefills the six from the previous set and starts with the edits', async () => {
    const storage = fakeStorage()
    const previous = {
      ...DEFAULT_LINEUP,
      zones: {
        ...DEFAULT_LINEUP.zones,
        1: { playerId: 'gorobchenko', role: ROLES.OPPOSITE },
      },
    }
    saveWith(storage, [setStart(previous, TEAMS.US), ...points(TEAMS.US, 25)])

    const { wrapper } = await mountView(TEAM_ROSTER, storage)
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Горобченко')

    await assign(wrapper, 4, 'fatkulin', ROLES.SETTER)
    await wrapper.get('[data-action="start-next-set"]').trigger('click')
    await flushPromises()

    const lineup = loadMatch(storage).events.at(-1).lineup
    expect(lineup.zones[1].playerId).toBe('gorobchenko')
    expect(lineup.zones[4].playerId).toBe('fatkulin')
  })

  it('asks who serves first in the fifth set', async () => {
    const storage = fakeStorage()
    const playedSet = (serving, winner) => [
      setStart(DEFAULT_LINEUP, serving),
      ...points(winner, 25),
    ]
    saveWith(storage, [
      ...playedSet(TEAMS.US, TEAMS.US),
      ...playedSet(TEAMS.THEM, TEAMS.THEM),
      ...playedSet(TEAMS.US, TEAMS.US),
      ...playedSet(TEAMS.THEM, TEAMS.THEM),
    ])

    const { wrapper, router } = await mountView(TEAM_ROSTER, storage)

    const start = wrapper.get('[data-action="start-next-set"]')
    expect(start.attributes('disabled')).toBeDefined()

    await wrapper.get('[data-field="tiebreak-serving-them"]').setValue()
    expect(start.attributes('disabled')).toBeUndefined()

    await start.trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('match')

    const events = loadMatch(storage).events
    expect(events.at(-1).serving).toBe(TEAMS.THEM)
    expect(matchState(events).setNumber).toBe(5)
  })
})
