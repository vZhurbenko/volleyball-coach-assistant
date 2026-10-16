import { describe, it, expect } from 'vitest'

import { ROLES } from '../constants.js'
import { MOCK_ROSTER, findPlayer } from '../players.js'

describe('mock roster', () => {
  it('holds twelve players', () => {
    expect(MOCK_ROSTER).toHaveLength(12)
  })

  it('gives every player a unique id', () => {
    const ids = MOCK_ROSTER.map((player) => player.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every player a unique jersey number', () => {
    const numbers = MOCK_ROSTER.map((player) => player.number)
    expect(new Set(numbers).size).toBe(numbers.length)
  })

  it('uses only known roles', () => {
    const knownRoles = Object.values(ROLES)
    for (const player of MOCK_ROSTER) {
      expect(knownRoles).toContain(player.role)
    }
  })

  it('includes at least one libero', () => {
    expect(MOCK_ROSTER.some((player) => player.role === ROLES.LIBERO)).toBe(true)
  })

  it('fills in every name and number', () => {
    for (const player of MOCK_ROSTER) {
      expect(player.firstName).toBeTruthy()
      expect(player.lastName).toBeTruthy()
      expect(player.number).toBeGreaterThan(0)
    }
  })
})

describe('findPlayer', () => {
  it('finds a player by id', () => {
    const [first] = MOCK_ROSTER
    expect(findPlayer(MOCK_ROSTER, first.id)).toBe(first)
  })

  it('returns undefined for an unknown id', () => {
    expect(findPlayer(MOCK_ROSTER, 'no-such-player')).toBeUndefined()
  })
})
