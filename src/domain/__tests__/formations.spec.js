import { describe, it, expect } from 'vitest'

import { ROLES, ZONES } from '../constants.js'
import { FORMATIONS, receivingPositions, setterZone } from '../formations.js'
import { defaultLineup } from '../lineup.js'
import { MOCK_ROSTER, findPlayer } from '../players.js'

/** Шестёрка базы 5-1: связка в зоне 1, значит расстановка 1. */
const SIX = defaultLineup(MOCK_ROSTER)

/** Шестёрка без связки — расстановку по ней не определить. */
const WITHOUT_SETTER = {
  zones: Object.fromEntries(
    ZONES.map((zone) => {
      const player = findPlayer(MOCK_ROSTER, SIX.zones[zone].playerId)
      return [
        zone,
        {
          playerId: player.role === ROLES.SETTER ? 'sokolov' : player.id,
          role: player.role === ROLES.SETTER ? ROLES.OUTSIDE_HITTER : player.role,
        },
      ]
    }),
  ),
  liberoId: null,
}

describe('FORMATIONS', () => {
  it('covers all six rotations', () => {
    for (const rotation of ZONES) {
      expect(FORMATIONS[rotation]).toBeDefined()
    }
  })

  it('places all six zones in every rotation', () => {
    for (const rotation of ZONES) {
      expect(Object.keys(FORMATIONS[rotation]).map(Number).sort()).toEqual(ZONES)
    }
  })

  it('keeps every position in percents on our half', () => {
    for (const rotation of ZONES) {
      for (const zone of ZONES) {
        const { x, y } = FORMATIONS[rotation][zone]
        expect(x).toBeGreaterThanOrEqual(0)
        expect(x).toBeLessThanOrEqual(100)
        expect(y).toBeGreaterThanOrEqual(0)
        expect(y).toBeLessThanOrEqual(100)
      }
    }
  })

  it('does not repeat one rotation twice', () => {
    const seen = new Set(ZONES.map((rotation) => JSON.stringify(FORMATIONS[rotation])))
    expect(seen.size).toBe(ZONES.length)
  })
})

describe('setterZone', () => {
  it('numbers the rotation by the setter zone, as the 5-1 does', () => {
    expect(setterZone({ lineup: SIX, rotations: 0 })).toBe(1)
    expect(setterZone({ lineup: SIX, rotations: 1 })).toBe(6)
    expect(setterZone({ lineup: SIX, rotations: 2 })).toBe(5)
  })

  it('walks the whole rotation cycle', () => {
    const cycle = [0, 1, 2, 3, 4, 5].map((rotations) => setterZone({ lineup: SIX, rotations }))
    expect(cycle).toEqual([1, 6, 5, 4, 3, 2])
  })

  it('has no rotation for a line-up without a setter', () => {
    expect(setterZone({ lineup: WITHOUT_SETTER, rotations: 0 })).toBeNull()
  })
})

describe('receivingPositions', () => {
  it('hands out the positions of the current rotation', () => {
    expect(receivingPositions({ lineup: SIX, rotations: 0 })).toEqual(FORMATIONS[1])
    expect(receivingPositions({ lineup: SIX, rotations: 1 })).toEqual(FORMATIONS[6])
  })

  it('has no positions without a setter', () => {
    expect(receivingPositions({ lineup: WITHOUT_SETTER, rotations: 0 })).toBeNull()
  })
})
