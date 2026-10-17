import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import { ROLES } from '../../domain/constants.js'
import LineupView from '../LineupView.vue'

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

describe('LineupView', () => {
  it('renders the screen heading', () => {
    const wrapper = mount(LineupView)
    expect(wrapper.text()).toContain('Расстановка')
  })

  it('shows six empty zones', () => {
    const wrapper = mount(LineupView)

    for (const zone of [1, 2, 3, 4, 5, 6]) {
      expect(wrapper.get(`[data-zone="${zone}"]`).text()).toContain('Назначить')
    }
  })

  it('assigns a player to a zone', async () => {
    const wrapper = mount(LineupView)

    await assign(wrapper, 4, 'sokolov', ROLES.OUTSIDE_HITTER)

    const zone = wrapper.get('[data-zone="4"]')
    expect(zone.text()).toContain('Соколов')
    expect(zone.text()).toContain('4')
    expect(zone.text()).toContain('Доигровщик')
  })

  it('lets the coach override the role on assignment', async () => {
    const wrapper = mount(LineupView)

    // Белов по составу связка, но назначаем его центральным блокирующим.
    await assign(wrapper, 3, 'belov', ROLES.MIDDLE_BLOCKER)

    const zone = wrapper.get('[data-zone="3"]')
    expect(zone.text()).toContain('Белов')
    expect(zone.text()).toContain('ЦБ')
    expect(zone.text()).not.toContain('Связка')
  })

  it('replaces the player when a filled zone is assigned again', async () => {
    const wrapper = mount(LineupView)
    await assign(wrapper, 4, 'sokolov', ROLES.OUTSIDE_HITTER)

    await assign(wrapper, 4, 'lebedev', ROLES.OUTSIDE_HITTER)

    const zone = wrapper.get('[data-zone="4"]')
    expect(zone.text()).toContain('Лебедев')
    expect(zone.text()).not.toContain('Соколов')
  })

  it('closes the dialog without assigning on cancel', async () => {
    const wrapper = mount(LineupView)
    await openZone(wrapper, 2)

    await wrapper.get('[data-action="cancel"]').trigger('click')

    expect(wrapper.find('[role="dialog"]').exists()).toBe(false)
    expect(wrapper.get('[data-zone="2"]').text()).toContain('Назначить')
  })
})
