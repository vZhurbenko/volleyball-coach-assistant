import { describe, it, expect } from 'vitest'

import { ZONES } from '../constants.js'
import { defaultLineup } from '../lineup.js'
import { liberoZone } from '../libero.js'
import { EVENT_TYPES, matchState, playersOnCourt } from '../match.js'
import { findPlayer } from '../players.js'
import { MOCK_ROSTER } from './fixtures/roster.js'
import { TEAMS } from '../score.js'

const RECEIVING = TEAMS.THEM
const SERVING = TEAMS.US

/** Расстановка из карты «зона → игрок», роли берутся у игроков. */
function lineupOf(assignments, liberoId = null) {
  const zones = Object.fromEntries(ZONES.map((zone) => [zone, null]))
  for (const [zone, playerId] of Object.entries(assignments)) {
    zones[zone] = { playerId, role: findPlayer(MOCK_ROSTER, playerId).role }
  }
  return { zones, liberoId }
}

/** Шестёрка базы 5-1 с либеро: ЦБ стоят в зонах 3 и 6. */
const SIX = { ...defaultLineup(MOCK_ROSTER), liberoId: 'zimin' }

/** Подающий ЦБ в зоне 1, второй ЦБ — в передней линии (зона 2). */
const MIDDLE_BLOCKER_SERVES = lineupOf(
  {
    1: 'morozov',
    2: 'volkov',
    3: 'belov',
    4: 'efimov',
    5: 'lebedev',
    6: 'sokolov',
  },
  'zimin',
)

const entry = (rotations, { lineup = SIX, serving = RECEIVING, liberoId = lineup.liberoId } = {}) =>
  liberoZone({ lineup, rotations, liberoId, serving })

describe('liberoZone', () => {
  it('keeps the libero out when none is assigned', () => {
    expect(entry(0, { liberoId: null })).toBeNull()
  })

  it('keeps the libero on the back line while we serve when the middle blocker is not the server', () => {
    // Подаёт связка из зоны 1, а ЦБ стоит в зоне 6 — либеро остаётся вместо него.
    expect(entry(0, { serving: SERVING })).toBe(6)
  })

  it('leaves the court when the back-line middle blocker is the server', () => {
    expect(entry(0, { lineup: MIDDLE_BLOCKER_SERVES, serving: SERVING })).toBeNull()
  })

  it('returns straight after the middle blocker loses the serve', () => {
    expect(entry(0, { lineup: MIDDLE_BLOCKER_SERVES, serving: RECEIVING })).toBe(1)
  })

  it('sends the libero in for the back-line middle blocker', () => {
    expect(entry(0)).toBe(6)
  })

  it('follows the back line through the whole rotation cycle', () => {
    const zones = [0, 1, 2, 3, 4, 5].map((rotations) => entry(rotations))
    expect(zones).toEqual([6, 5, 1, 6, 5, 1])
  })

  it('stays with the back-line middle blocker through our serves until he returns to the front line', () => {
    const zones = [0, 1, 2, 3, 4, 5].map((rotations) =>
      entry(rotations, { serving: SERVING }),
    )
    expect(zones).toEqual([6, 5, null, 6, 5, null])
  })

  it('brings the libero in and out with a single middle blocker', () => {
    const oneMiddleBlocker = lineupOf(
      {
        1: 'belov',
        2: 'sokolov',
        3: 'morozov',
        4: 'efimov',
        5: 'lebedev',
        6: 'gusev',
      },
      'zimin',
    )

    const zones = [0, 1, 2, 3, 4, 5].map((rotations) =>
      entry(rotations, { lineup: oneMiddleBlocker }),
    )
    expect(zones).toEqual([null, null, 1, 6, 5, null])
  })

  it('picks the middle blocker who rotated from the front line to the back line', () => {
    const bothOnBackLine = lineupOf(
      {
        1: 'morozov',
        2: 'sokolov',
        3: 'belov',
        4: 'efimov',
        5: 'lebedev',
        6: 'volkov',
      },
      'zimin',
    )

    expect(entry(0, { lineup: bothOnBackLine })).toBe(1)
  })

  it('stays out when no middle blocker is on the back line', () => {
    const noMiddleBlocker = lineupOf(
      {
        1: 'belov',
        2: 'sokolov',
        3: 'efimov',
        4: 'gusev',
        5: 'lebedev',
        6: 'orlov',
      },
      'zimin',
    )

    expect(entry(0, { lineup: noMiddleBlocker })).toBeNull()
  })
})

describe('playersOnCourt with a libero', () => {
  const start = (serving) => [{ type: EVENT_TYPES.SET_START, lineup: SIX, serving }]

  it('shows the libero instead of the middle blocker on the receive', () => {
    const court = playersOnCourt(matchState(start(RECEIVING)))
    expect(court[6]).toBe('zimin')
    expect(court[3]).toBe('morozov')
  })

  it('keeps the libero on the back line while we serve', () => {
    const court = playersOnCourt(matchState(start(SERVING)))
    expect(court[6]).toBe('zimin')
    expect(court[3]).toBe('morozov')
  })

  it('sends the middle blocker out to serve', () => {
    const court = playersOnCourt(
      matchState([{ type: EVENT_TYPES.SET_START, lineup: MIDDLE_BLOCKER_SERVES, serving: SERVING }]),
    )
    expect(court[1]).toBe('morozov')
  })

  it('keeps the libero on the back line on our serve after a side-out', () => {
    const journal = [...start(RECEIVING), { type: EVENT_TYPES.POINT, team: TEAMS.US }]

    const court = playersOnCourt(matchState(journal))
    expect(court[5]).toBe('zimin')
    expect(court[6]).toBe('belov')
  })

  it('moves the libero with the rotation', () => {
    const journal = [
      ...start(SERVING),
      { type: EVENT_TYPES.POINT, team: TEAMS.THEM },
      { type: EVENT_TYPES.POINT, team: TEAMS.US },
      { type: EVENT_TYPES.POINT, team: TEAMS.THEM },
      { type: EVENT_TYPES.POINT, team: TEAMS.US },
      { type: EVENT_TYPES.POINT, team: TEAMS.THEM },
    ]

    const court = playersOnCourt(matchState(journal))
    expect(court[1]).toBe('zimin')
    expect(court[6]).toBe('sokolov')
  })
})
