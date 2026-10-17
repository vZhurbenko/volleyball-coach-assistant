import { beforeEach, describe, expect, it } from 'vitest'

import { Fragment } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROLES } from '../../domain/constants.js'
import { defaultLineup } from '../../domain/lineup.js'
import { TEAM_ROSTER } from '../../domain/__tests__/fixtures/team-roster.js'
import { loadRosterSettings, saveRosterSettings } from '../../storage.js'
import RosterView from '../RosterView.vue'

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

const DEFAULT_SIX = defaultLineup(TEAM_ROSTER)

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/roster', name: 'roster', component: { template: '<div />' } },
    ],
  })
}

async function mountView({ storage = fakeStorage(), settings } = {}) {
  saveRosterSettings(settings ?? { players: TEAM_ROSTER, defaultLineup: DEFAULT_SIX }, storage)

  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/roster')
  await router.isReady()

  const wrapper = mount(RosterView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router, storage }
}

async function openAddForm(wrapper) {
  await wrapper.get('[data-action="add-player"]').trigger('click')
}

async function fillForm(wrapper, { number, firstName, lastName, role }) {
  await wrapper.get('[data-field="player-number"]').setValue(String(number))
  await wrapper.get('[data-field="player-first-name"]').setValue(firstName)
  await wrapper.get('[data-field="player-last-name"]').setValue(lastName)
  await wrapper.get('[data-field="player-role"]').setValue(role)
}

async function submitForm(wrapper) {
  await wrapper.get('[data-field="player-form"]').trigger('submit')
  await flushPromises()
}

async function addPlayer(wrapper, player) {
  await openAddForm(wrapper)
  await fillForm(wrapper, player)
  await submitForm(wrapper)
}

const NEW_PLAYER = {
  number: 13,
  firstName: 'Иван',
  lastName: 'Петров',
  role: ROLES.OUTSIDE_HITTER,
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('RosterView', () => {
  it('renders a single root element for the screen transition', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.getCurrentComponent().subTree.type).not.toBe(Fragment)
  })

  it('shows the roster and the default starting six from storage', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.findAll('[data-roster-player]')).toHaveLength(TEAM_ROSTER.length)
    expect(wrapper.text()).toContain('Журбенко')
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Титов')
    expect(wrapper.get('[data-zone="4"]').text()).toContain('Панчишкина')
  })

  it('lists players by number', async () => {
    const { wrapper } = await mountView()

    const numbers = wrapper.findAll('.roster-row__number').map((item) => item.text())
    expect(numbers).toEqual(['2', '3', '5', '9', '9', '10', '11', '12', '14', '17', '50'])
  })

  it('stores the default team name', async () => {
    const { wrapper, storage } = await mountView()
    const input = wrapper.get('[data-field="default-team-name"]')

    expect(input.element.value).toBe('')

    await input.setValue('Наши')
    await input.trigger('change')

    expect(loadRosterSettings(storage).teamName).toBe('Наши')
  })

  it('shows the saved default team name', async () => {
    const { wrapper } = await mountView({
      settings: {
        players: TEAM_ROSTER,
        defaultLineup: DEFAULT_SIX,
        teamName: 'Динамо-2',
      },
    })

    expect(wrapper.get('[data-field="default-team-name"]').element.value).toBe('Динамо-2')
  })

  it('adds a player and persists them', async () => {
    const { wrapper, storage } = await mountView()

    await addPlayer(wrapper, NEW_PLAYER)

    expect(wrapper.findAll('[data-roster-player]')).toHaveLength(TEAM_ROSTER.length + 1)
    expect(wrapper.text()).toContain('Иван Петров')
    expect(loadRosterSettings(storage).players).toContainEqual(
      expect.objectContaining({
        firstName: 'Иван',
        lastName: 'Петров',
        number: 13,
        role: ROLES.OUTSIDE_HITTER,
      }),
    )
  })

  it('shows validation errors and adds nothing on an empty submit', async () => {
    const { wrapper, storage } = await mountView()
    await openAddForm(wrapper)

    await submitForm(wrapper)

    expect(wrapper.get('[role="alert"]').text()).toContain('Укажите имя')
    expect(wrapper.get('[role="alert"]').text()).toContain('Укажите фамилию')
    expect(wrapper.get('[role="alert"]').text()).toContain('Номер')
    expect(wrapper.get('[role="alert"]').text()).toContain('Выберите роль')
    expect(wrapper.findAll('[data-roster-player]')).toHaveLength(TEAM_ROSTER.length)
    expect(loadRosterSettings(storage).players).toHaveLength(TEAM_ROSTER.length)
  })

  it('edits an existing player', async () => {
    const { wrapper, storage } = await mountView()

    await wrapper
      .get('[data-roster-player="zhurbenko"] [data-action="edit-player"]')
      .trigger('click')

    expect(wrapper.get('[data-field="player-last-name"]').element.value).toBe('Журбенко')

    await fillForm(wrapper, {
      number: 33,
      firstName: 'Владислав',
      lastName: 'Журбенко-младший',
      role: ROLES.MIDDLE_BLOCKER,
    })
    await submitForm(wrapper)

    const row = wrapper.get('[data-roster-player="zhurbenko"]')
    expect(row.text()).toContain('Журбенко-младший')
    expect(row.text()).toContain('33')
    expect(loadRosterSettings(storage).players).toContainEqual(
      expect.objectContaining({ id: 'zhurbenko', number: 33, lastName: 'Журбенко-младший' }),
    )
  })

  it('cancels editing without changes', async () => {
    const { wrapper, storage } = await mountView()
    const before = loadRosterSettings(storage)

    await wrapper
      .get('[data-roster-player="zhurbenko"] [data-action="edit-player"]')
      .trigger('click')
    await wrapper.get('[data-field="player-last-name"]').setValue('Другая фамилия')
    await wrapper.get('[data-action="cancel-player"]').trigger('click')

    expect(wrapper.get('[data-roster-player="zhurbenko"]').text()).toContain('Журбенко')
    expect(loadRosterSettings(storage)).toEqual(before)
  })

  it('removes a starter from the roster and from the six', async () => {
    const { wrapper, storage } = await mountView()

    await wrapper
      .get('[data-roster-player="titov"] [data-action="remove-player"]')
      .trigger('click')

    expect(wrapper.find('[data-roster-player="titov"]').exists()).toBe(false)
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Назначить')
    expect(wrapper.get('[role="alert"]').text()).toContain('Зона 1 не заполнена')

    expect(loadRosterSettings(storage).players.some((player) => player.id === 'titov')).toBe(false)
    expect(loadRosterSettings(storage).defaultLineup.zones[1]).toBeNull()
  })

  it('assigns a player to the default six and persists it', async () => {
    const { wrapper, storage } = await mountView()

    await wrapper.get('[data-zone="1"]').trigger('click')
    await wrapper.get('[data-player-id="fatkulin"]').trigger('click')
    await wrapper.get('[data-role="setter"]').trigger('click')

    expect(wrapper.get('[data-zone="1"]').text()).toContain('Фаткулин')
    expect(loadRosterSettings(storage).defaultLineup.zones[1]).toEqual({
      playerId: 'fatkulin',
      role: ROLES.SETTER,
    })
  })

  it('keeps the roster after a reload', async () => {
    const first = await mountView()
    await addPlayer(first.wrapper, NEW_PLAYER)

    const pinia = createPinia()
    setActivePinia(pinia)
    const router = testRouter()
    await router.push('/roster')
    await router.isReady()
    const second = mount(RosterView, {
      props: { storage: first.storage },
      global: { plugins: [pinia, router] },
    })

    expect(second.text()).toContain('Иван Петров')
    expect(second.get('[data-zone="1"]').text()).toContain('Титов')
  })

  it('exports the roster and the default six as JSON into the text area', async () => {
    const { wrapper } = await mountView()
    await wrapper.get('[data-field="default-team-name"]').setValue('Наши')
    await wrapper.get('[data-field="default-team-name"]').trigger('change')

    await wrapper.get('[data-action="export-roster"]').trigger('click')
    await flushPromises()

    const payload = JSON.parse(wrapper.get('[data-field="roster-json"]').element.value)
    expect(payload.version).toBe(1)
    expect(payload.teamName).toBe('Наши')
    expect(payload.players).toHaveLength(TEAM_ROSTER.length)
    expect(payload.defaultLineup).toEqual(DEFAULT_SIX)
  })

  it('replaces the roster from the pasted JSON', async () => {
    const { wrapper, storage } = await mountView()
    const json = JSON.stringify({
      version: 1,
      teamName: 'Импортные',
      players: [
        { id: 'imported', firstName: 'Новый', lastName: 'Игрок', number: 77, role: ROLES.SETTER },
      ],
      defaultLineup: {
        zones: {
          1: { playerId: 'imported', role: ROLES.SETTER },
          2: null,
          3: null,
          4: null,
          5: null,
          6: null,
        },
        liberoId: null,
      },
    })

    await wrapper.get('[data-field="roster-json"]').setValue(json)
    await wrapper.get('[data-action="import-roster"]').trigger('click')
    await flushPromises()

    expect(wrapper.findAll('[data-roster-player]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Новый Игрок')
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Игрок')
    expect(wrapper.get('[data-field="default-team-name"]').element.value).toBe('Импортные')
    expect(wrapper.get('[role="status"]').text()).toContain('Состав заменён')
    expect(loadRosterSettings(storage).players[0].id).toBe('imported')
    expect(loadRosterSettings(storage).teamName).toBe('Импортные')
  })

  it('reports broken JSON and keeps the roster', async () => {
    const { wrapper, storage } = await mountView()

    await wrapper.get('[data-field="roster-json"]').setValue('{не json')
    await wrapper.get('[data-action="import-roster"]').trigger('click')
    await flushPromises()

    expect(wrapper.get('[role="status"]').text()).toContain('Не удалось разобрать JSON')
    expect(wrapper.findAll('[data-roster-player]')).toHaveLength(TEAM_ROSTER.length)
    expect(loadRosterSettings(storage).players).toHaveLength(TEAM_ROSTER.length)
  })

  it('returns to the lineup', async () => {
    const { wrapper, router } = await mountView()

    await wrapper.get('[data-action="back-to-lineup"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('lineup')
  })
})
