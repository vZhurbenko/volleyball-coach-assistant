import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import { ROLES } from '../../domain/constants.js'
import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/__tests__/fixtures/team-roster.js'
import { TEAMS } from '../../domain/score.js'
import MatchCourt from '../MatchCourt.vue'

const LINEUP = defaultLineup(TEAM_ROSTER)
const START_US = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.US }
const START_THEM = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.THEM }

const LIBERO = {
  id: 'test-libero',
  firstName: 'Илья',
  lastName: 'Тестов',
  number: 99,
  role: ROLES.LIBERO,
}
const ROSTER_WITH_LIBERO = [...TEAM_ROSTER, LIBERO]
const LINEUP_WITH_LIBERO = {
  ...defaultLineup(ROSTER_WITH_LIBERO),
  liberoId: LIBERO.id,
}

function mountCourt(events, { mode = 'protocol', roster = TEAM_ROSTER } = {}) {
  return mount(MatchCourt, {
    props: { state: matchState(events), roster, mode },
  })
}

function gamePlayer(wrapper, playerId) {
  return wrapper.get(`[data-game-player="${playerId}"]`)
}

function playerIn(wrapper, zone) {
  return wrapper.get(`[data-zone="${zone}"]`).attributes('data-player-id')
}

describe('MatchCourt in protocol mode', () => {
  it('places the six players in their protocol zones', () => {
    const wrapper = mountCourt([START_US])

    expect(playerIn(wrapper, 1)).toBe('titov')
    expect(playerIn(wrapper, 2)).toBe('verzhenovsky')
    expect(playerIn(wrapper, 3)).toBe('gromov')
    expect(playerIn(wrapper, 4)).toBe('panchishkina')
    expect(playerIn(wrapper, 5)).toBe('abroskin')
    expect(playerIn(wrapper, 6)).toBe('komissarov')
  })

  it('shows the number, the last name and the role in the circle', () => {
    const wrapper = mountCourt([START_US])

    const circle = wrapper.get('[data-zone="1"]')
    expect(circle.findAll('span').map((span) => span.text())).toEqual([
      '2',
      'Титов',
      'Диагональный',
    ])
  })

  it('places the protocol circles by their zones', () => {
    const wrapper = mountCourt([START_US])

    const zoneOne = wrapper.get('[data-zone="1"]')
    expect(zoneOne.attributes('data-x')).toBe('83')
    expect(zoneOne.attributes('data-y')).toBe('78')
  })

  it('shows only our six players', () => {
    const wrapper = mountCourt([START_US])

    expect(wrapper.findAll('[data-zone]')).toHaveLength(6)
  })

  it('rotates the six automatically when the serve changes hands', () => {
    const wrapper = mountCourt([START_THEM, { type: EVENT_TYPES.POINT, team: TEAMS.US }])

    // Один сдвиг: слот 2 (Верженовский) переезжает в зону 1, слот 1 (Титов) — в зону 6.
    expect(playerIn(wrapper, 1)).toBe('verzhenovsky')
    expect(playerIn(wrapper, 2)).toBe('gromov')
    expect(playerIn(wrapper, 6)).toBe('titov')
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Доигровщик')
  })

  it('emits the player id on tap', async () => {
    const wrapper = mountCourt([START_US])

    await wrapper.get('[data-zone="4"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['panchishkina']])
  })
})

describe('MatchCourt in game mode', () => {
  it('draws the three-metre attack line', () => {
    const wrapper = mountCourt([START_US], { mode: 'game' })

    expect(wrapper.find('.court-half__attack-line').exists()).toBe(true)
  })

  it('shows the protocol zone label above every circle in game mode', () => {
    const wrapper = mountCourt([START_US], { mode: 'game' })

    expect(wrapper.findAll('.court-half__zone')).toHaveLength(6)
  })

  it('places the six by the reception coordinates', () => {
    const wrapper = mountCourt([START_US], { mode: 'game' })

    expect(wrapper.findAll('[data-game-player]')).toHaveLength(6)

    const opposite = gamePlayer(wrapper, 'titov')
    expect(opposite.attributes('data-zone')).toBe('1')
    expect(opposite.attributes('data-x')).toBe('94')
    expect(opposite.attributes('data-y')).toBe('94')

    const setter = gamePlayer(wrapper, 'panchishkina')
    expect(setter.attributes('data-zone')).toBe('4')
    expect(setter.attributes('data-x')).toBe('6')
    expect(setter.attributes('data-y')).toBe('6')
  })

  it('updates the positions when the six rotates', () => {
    // Переход подачи сдвигает связку из зоны 4 в зону 3 — берётся расстановка 3.
    const wrapper = mountCourt([START_THEM, { type: EVENT_TYPES.POINT, team: TEAMS.US }], {
      mode: 'game',
    })

    const player = gamePlayer(wrapper, 'verzhenovsky')
    expect(player.attributes('data-zone')).toBe('1')
    expect(player.attributes('data-x')).toBe('73')
    expect(player.attributes('data-y')).toBe('73')
  })

  it('shows the libero in play on the receive', () => {
    const wrapper = mountCourt(
      [{ type: EVENT_TYPES.SET_START, lineup: LINEUP_WITH_LIBERO, serving: TEAMS.THEM }],
      { mode: 'game', roster: ROSTER_WITH_LIBERO },
    )

    expect(wrapper.findAll('[data-game-player]')).toHaveLength(6)
    expect(wrapper.find('[data-game-player="test-libero"]').exists()).toBe(true)
    expect(wrapper.find('[data-game-player="komissarov"]').exists()).toBe(false)
  })

  it('keeps the libero on the back line while we serve', () => {
    const wrapper = mountCourt(
      [{ type: EVENT_TYPES.SET_START, lineup: LINEUP_WITH_LIBERO, serving: TEAMS.US }],
      { mode: 'game', roster: ROSTER_WITH_LIBERO },
    )

    expect(wrapper.find('[data-game-player="test-libero"]').exists()).toBe(true)
    expect(wrapper.find('[data-game-player="komissarov"]').exists()).toBe(false)
  })

  it('puts the middle blocker on court when he serves', () => {
    const lineup = {
      ...LINEUP_WITH_LIBERO,
      zones: {
        ...LINEUP_WITH_LIBERO.zones,
        1: { playerId: 'komissarov', role: ROLES.MIDDLE_BLOCKER },
        6: { playerId: 'titov', role: ROLES.OPPOSITE },
      },
    }

    const wrapper = mountCourt(
      [{ type: EVENT_TYPES.SET_START, lineup, serving: TEAMS.US }],
      { roster: ROSTER_WITH_LIBERO },
    )

    expect(playerIn(wrapper, 1)).toBe('komissarov')
    expect(wrapper.find('[data-player-id="test-libero"]').exists()).toBe(false)
  })

  it('labels a libero of another role as a libero', () => {
    const lineup = { ...defaultLineup(TEAM_ROSTER), liberoId: 'timofeev' }
    const wrapper = mountCourt(
      [{ type: EVENT_TYPES.SET_START, lineup, serving: TEAMS.THEM }],
      { mode: 'game' },
    )

    const libero = gamePlayer(wrapper, 'timofeev')
    expect(libero.text()).toContain('Либеро')
    expect(libero.text()).not.toContain('Доигровщик')
    expect(libero.classes()).toContain('court-half__player--libero')
    expect(libero.attributes('aria-label')).toContain('Либеро')
  })

  it('emits the player id on tap', async () => {
    const wrapper = mountCourt([START_US], { mode: 'game' })

    await gamePlayer(wrapper, 'titov').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['titov']])
  })
})
