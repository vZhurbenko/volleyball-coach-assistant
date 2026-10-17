import { describe, it, expect } from 'vitest'

import { mount } from '@vue/test-utils'

import { TEAMS } from '../../domain/score.js'
import SetPointLog from '../SetPointLog.vue'

const HISTORY = [
  { setNumber: 1, team: TEAMS.US },
  { setNumber: 1, team: TEAMS.THEM },
  { setNumber: 1, team: TEAMS.US },
  { setNumber: 1, team: TEAMS.US },
  { setNumber: 2, team: TEAMS.THEM },
]

const US_WON = { number: 1, points: { us: 25, them: 10 } }
const THEM_WON = { number: 1, points: { us: 10, them: 25 } }

function mountLog(set = US_WON) {
  return mount(SetPointLog, {
    props: { set, history: HISTORY, teamName: 'Наши', opponent: 'Динамо' },
  })
}

function cells(row) {
  return row.findAll('td').map((cell) => cell.text())
}

describe('SetPointLog', () => {
  it('puts us first and shows the score in the scoring column', () => {
    const wrapper = mountLog(US_WON)

    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['Наши', 'Динамо'])

    const rows = wrapper.findAll('[data-point-row]')
    expect(rows).toHaveLength(4)
    expect(cells(rows[0])).toEqual(['1', ''])
    expect(cells(rows[1])).toEqual(['', '1'])
    expect(cells(rows[2])).toEqual(['2', ''])
    expect(cells(rows[3])).toEqual(['3', ''])

    expect(rows[0].findAll('td')[0].classes()).toContain('point-log__score--us')
    expect(rows[1].findAll('td')[1].classes()).toContain('point-log__score--them')
  })

  it('keeps us first when the opponent wins the set', () => {
    const wrapper = mountLog(THEM_WON)

    expect(wrapper.findAll('th').map((th) => th.text())).toEqual(['Наши', 'Динамо'])

    const rows = wrapper.findAll('[data-point-row]')
    expect(cells(rows[0])).toEqual(['1', ''])
    expect(cells(rows[1])).toEqual(['', '1'])

    expect(rows[0].findAll('td')[0].classes()).toContain('point-log__score--us')
    expect(rows[1].findAll('td')[1].classes()).toContain('point-log__score--them')
  })
})
