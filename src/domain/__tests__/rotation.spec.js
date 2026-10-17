import { describe, it, expect } from 'vitest'

import { ZONES } from '../constants.js'
import { emptyLineup, defaultLineup } from '../lineup.js'
import { MOCK_ROSTER } from './fixtures/roster.js'
import { TEAMS } from '../score.js'
import { ROTATION, rotate, rotates } from '../rotation.js'

/** Шесть сдвигов по часовой — расстановка возвращается на место. */
function rotateSixTimes(lineup) {
  let rotated = lineup
  for (let step = 0; step < ZONES.length; step += 1) {
    rotated = rotate(rotated)
  }
  return rotated
}

describe('ROTATION', () => {
  it('sends every zone to the next one clockwise', () => {
    expect(ROTATION).toEqual({ 1: 6, 2: 1, 3: 2, 4: 3, 5: 4, 6: 5 })
  })
})

describe('rotate', () => {
  it('moves the player of zone 2 to zone 1', () => {
    const before = defaultLineup(MOCK_ROSTER)
    expect(rotate(before).zones[1]).toEqual(before.zones[2])
  })

  it('moves the player of zone 1 to zone 6', () => {
    const before = defaultLineup(MOCK_ROSTER)
    expect(rotate(before).zones[6]).toEqual(before.zones[1])
  })

  it('keeps the player role with the player', () => {
    const before = defaultLineup(MOCK_ROSTER)
    const rotated = rotate(before)
    for (const zone of ZONES) {
      expect(rotated.zones[ROTATION[zone]].role).toBe(before.zones[zone].role)
    }
  })

  it('returns the original six after six rotations', () => {
    const before = defaultLineup(MOCK_ROSTER)
    expect(rotateSixTimes(before)).toEqual(before)
  })

  it('leaves empty zones empty', () => {
    expect(rotate(emptyLineup()).zones).toEqual(emptyLineup().zones)
  })

  it('keeps the libero out of the rotation', () => {
    const before = { ...defaultLineup(MOCK_ROSTER), liberoId: 'zimin' }
    expect(rotate(before).liberoId).toBe('zimin')
  })

  it('leaves the incoming lineup untouched', () => {
    const before = defaultLineup(MOCK_ROSTER)
    const snapshot = structuredClone(before)
    rotate(before)
    expect(before).toEqual(snapshot)
  })
})

describe('rotates', () => {
  it('rotates when we take a point on the opponent serve', () => {
    expect(rotates(TEAMS.THEM, TEAMS.US)).toBe(true)
  })

  it('does not rotate when we take a point on our own serve', () => {
    expect(rotates(TEAMS.US, TEAMS.US)).toBe(false)
  })

  it('does not rotate when the opponent takes a point', () => {
    expect(rotates(TEAMS.US, TEAMS.THEM)).toBe(false)
    expect(rotates(TEAMS.THEM, TEAMS.THEM)).toBe(false)
  })
})
