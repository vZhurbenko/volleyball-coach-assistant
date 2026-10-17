import { describe, it, expect } from 'vitest'

import { ROLES, ZONES } from '../constants.js'
import { defaultLineup, validateLineup } from '../lineup.js'
import { TEAM_ROSTER, findPlayer } from '../players.js'

describe('team roster', () => {
  it('holds the eleven players', () => {
    expect(TEAM_ROSTER).toHaveLength(11)
  })

  it('gives every player a unique id', () => {
    const ids = TEAM_ROSTER.map((player) => player.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('gives every player a positive jersey number', () => {
    for (const player of TEAM_ROSTER) {
      expect(player.number).toBeGreaterThan(0)
    }
  })

  it('uses only known roles', () => {
    const knownRoles = Object.values(ROLES)
    for (const player of TEAM_ROSTER) {
      expect(knownRoles).toContain(player.role)
    }
  })

  it('has no libero in the current team', () => {
    expect(TEAM_ROSTER.some((player) => player.role === ROLES.LIBERO)).toBe(false)
  })

  it('marks exactly the six starters with unique zones', () => {
    const starters = TEAM_ROSTER.filter((player) => player.startingZone != null)

    expect(starters).toHaveLength(6)
    expect(starters.map((player) => player.startingZone).sort()).toEqual(ZONES)
  })

  it('fills in every name and number', () => {
    for (const player of TEAM_ROSTER) {
      expect(player.firstName).toBeTruthy()
      expect(player.lastName).toBeTruthy()
      expect(player.number).toBeGreaterThan(0)
    }
  })
})

describe('findPlayer', () => {
  it('finds a player by id', () => {
    const [first] = TEAM_ROSTER
    expect(findPlayer(TEAM_ROSTER, first.id)).toBe(first)
  })

  it('returns undefined for an unknown id', () => {
    expect(findPlayer(TEAM_ROSTER, 'no-such-player')).toBeUndefined()
  })
})

describe('defaultLineup from the team roster', () => {
  it('places the declared starting six into their zones', () => {
    const { zones } = defaultLineup(TEAM_ROSTER)

    const starters = Object.fromEntries(ZONES.map((zone) => [zone, zones[zone].playerId]))
    expect(starters).toEqual({
      1: 'titov',
      2: 'verzhenovsky',
      3: 'gromov',
      4: 'panchishkina',
      5: 'abroskin',
      6: 'komissarov',
    })
  })

  it('builds a valid starting six', () => {
    expect(validateLineup(defaultLineup(TEAM_ROSTER), TEAM_ROSTER).valid).toBe(true)
  })
})
