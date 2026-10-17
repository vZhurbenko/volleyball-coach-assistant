import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../../domain/match.js'
import { MOCK_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import MatchCourt from '../MatchCourt.vue'

const LINEUP = defaultLineup(MOCK_ROSTER)
const START_US = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.US }
const START_THEM = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.THEM }

function mountCourt(events) {
  return mount(MatchCourt, {
    props: { state: matchState(events), roster: MOCK_ROSTER },
  })
}

function playerIn(wrapper, zone) {
  return wrapper.get(`[data-zone="${zone}"]`).attributes('data-player-id')
}

describe('MatchCourt in protocol mode', () => {
  it('places the six players in their protocol zones', () => {
    const wrapper = mountCourt([START_US])

    expect(playerIn(wrapper, 1)).toBe('belov')
    expect(playerIn(wrapper, 2)).toBe('sokolov')
    expect(playerIn(wrapper, 3)).toBe('morozov')
    expect(playerIn(wrapper, 4)).toBe('efimov')
    expect(playerIn(wrapper, 5)).toBe('lebedev')
    expect(playerIn(wrapper, 6)).toBe('volkov')
  })

  it('shows the game number and the role in the circle', () => {
    const wrapper = mountCourt([START_US])

    const circle = wrapper.get('[data-zone="1"]')
    expect(circle.text()).toContain('7')
    expect(circle.text()).toContain('Связка')
  })

  it('shows only our six players', () => {
    const wrapper = mountCourt([START_US])

    expect(wrapper.findAll('[data-zone]')).toHaveLength(6)
  })

  it('rotates the six automatically when the serve changes hands', () => {
    const wrapper = mountCourt([START_THEM, { type: EVENT_TYPES.POINT, team: TEAMS.US }])

    // Один сдвиг: слот 2 (Соколов) переезжает в зону 1, слот 1 (Белов) — в зону 6.
    expect(playerIn(wrapper, 1)).toBe('sokolov')
    expect(playerIn(wrapper, 2)).toBe('morozov')
    expect(playerIn(wrapper, 6)).toBe('belov')
    expect(wrapper.get('[data-zone="1"]').text()).toContain('Доигровщик')
  })

  it('emits the player id on tap', async () => {
    const wrapper = mountCourt([START_US])

    await wrapper.get('[data-zone="4"]').trigger('click')

    expect(wrapper.emitted('select')).toEqual([['efimov']])
  })
})
