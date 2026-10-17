import { beforeEach, describe, expect, it } from 'vitest'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ROLES } from '../../domain/constants.js'
import { TEAM_ROSTER } from '../../domain/players.js'
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

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/setup', name: 'setup', component: { template: '<div />' } },
    ],
  })
}

/** Монтирует экран с чистым store и роутером — как в приложении. */
async function mountView(roster = TEAM_ROSTER) {
  const pinia = createPinia()
  setActivePinia(pinia)
  useLineupStore().init(roster)

  const router = testRouter()
  await router.push('/')
  await router.isReady()

  const wrapper = mount(LineupView, { global: { plugins: [pinia, router] } })
  return { wrapper, router }
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
