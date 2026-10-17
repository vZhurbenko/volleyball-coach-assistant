import { describe, expect, it } from 'vitest'

import { ROLES, ZONES } from '../constants.js'
import {
  applyRoleChange,
  createPlayer,
  isRoster,
  reconcileLineup,
  removePlayerFromLineup,
  sortRoster,
  validatePlayer,
} from '../roster.js'
import { MOCK_ROSTER } from './fixtures/roster.js'

/** Пустые зоны: { 1: null, …, 6: null }. */
function emptyZones() {
  return Object.fromEntries(ZONES.map((zone) => [zone, null]))
}

function lineupFrom(zones = {}, liberoId = null) {
  return { zones: { ...emptyZones(), ...zones }, liberoId }
}

const codesOf = (violations) => violations.map((violation) => violation.code)

const VALID_PLAYER = {
  firstName: 'Иван',
  lastName: 'Петров',
  number: 13,
  role: ROLES.OUTSIDE_HITTER,
}

describe('validatePlayer', () => {
  it('accepts a complete player and a numeric string number', () => {
    expect(validatePlayer({ ...VALID_PLAYER, number: '13' })).toEqual({
      valid: true,
      violations: [],
    })
  })

  it('requires the first name', () => {
    const result = validatePlayer({ ...VALID_PLAYER, firstName: '   ' })

    expect(result.valid).toBe(false)
    expect(codesOf(result.violations)).toContain('FIRST_NAME_REQUIRED')
  })

  it('requires the last name', () => {
    const result = validatePlayer({ ...VALID_PLAYER, lastName: '' })

    expect(result.valid).toBe(false)
    expect(codesOf(result.violations)).toContain('LAST_NAME_REQUIRED')
  })

  it.each([0, 100, -3, 1.5, 'семь', undefined])('rejects the number %s', (number) => {
    const result = validatePlayer({ ...VALID_PLAYER, number })

    expect(result.valid).toBe(false)
    expect(codesOf(result.violations)).toContain('INVALID_NUMBER')
  })

  it('requires a known role', () => {
    const result = validatePlayer({ ...VALID_PLAYER, role: 'coach' })

    expect(result.valid).toBe(false)
    expect(codesOf(result.violations)).toContain('INVALID_ROLE')
  })

  it('allows the libero role and duplicate jersey numbers', () => {
    expect(validatePlayer({ ...VALID_PLAYER, role: ROLES.LIBERO }).valid).toBe(true)
    expect(validatePlayer({ ...VALID_PLAYER, number: 9 }).valid).toBe(true)
  })
})

describe('createPlayer', () => {
  it('trims the names, normalizes the number and drops extra fields', () => {
    const player = createPlayer(
      { ...VALID_PLAYER, firstName: ' Иван ', lastName: ' Петров ', startingZone: 4 },
      'test-player',
    )

    expect(player).toEqual({
      id: 'test-player',
      firstName: 'Иван',
      lastName: 'Петров',
      number: 13,
      role: ROLES.OUTSIDE_HITTER,
    })
  })

  it('does not mutate the input', () => {
    const input = { ...VALID_PLAYER, firstName: ' Иван ' }
    createPlayer(input, 'test-player')

    expect(input.firstName).toBe(' Иван ')
  })
})

describe('isRoster', () => {
  it('accepts a real roster, an empty roster and duplicate numbers', () => {
    expect(isRoster(MOCK_ROSTER)).toBe(true)
    expect(isRoster([])).toBe(true)

    const twins = [
      { ...VALID_PLAYER, id: 'one', number: 9 },
      { ...VALID_PLAYER, id: 'two', number: 9 },
    ]
    expect(isRoster(twins)).toBe(true)
  })

  it.each([
    ['not an array', { players: [] }],
    ['a player without an id', [{ ...VALID_PLAYER }]],
    ['an invalid role', [{ ...VALID_PLAYER, id: 'x', role: 'coach' }]],
    ['an invalid number', [{ ...VALID_PLAYER, id: 'x', number: 0 }]],
  ])('rejects %s', (_name, value) => {
    expect(isRoster(value)).toBe(false)
  })

  it('rejects duplicate player ids', () => {
    const roster = [
      { ...VALID_PLAYER, id: 'same' },
      { ...VALID_PLAYER, id: 'same', number: 15 },
    ]

    expect(isRoster(roster)).toBe(false)
  })
})

describe('sortRoster', () => {
  it('sorts by number, then by last name and first name', () => {
    const players = [
      { ...VALID_PLAYER, id: 'far', number: 9, lastName: 'Фаткулин', firstName: 'Рафкат' },
      { ...VALID_PLAYER, id: 'near', number: 9, lastName: 'Аброскин', firstName: 'Илья' },
      { ...VALID_PLAYER, id: 'first', number: 2, lastName: 'Титов', firstName: 'Александр' },
    ]

    expect(sortRoster(players).map((player) => player.id)).toEqual(['first', 'near', 'far'])
  })

  it('does not mutate the source roster', () => {
    const players = [
      { ...VALID_PLAYER, id: 'late', number: 20 },
      { ...VALID_PLAYER, id: 'early', number: 1 },
    ]

    sortRoster(players)

    expect(players.map((player) => player.id)).toEqual(['late', 'early'])
  })
})

describe('removePlayerFromLineup', () => {
  const lineup = lineupFrom(
    {
      1: { playerId: 'belov', role: ROLES.SETTER },
      4: { playerId: 'efimov', role: ROLES.OPPOSITE },
    },
    'efimov',
  )

  it('clears every zone and the libero slot of the removed player', () => {
    const next = removePlayerFromLineup(
      { ...lineup, zones: { ...lineup.zones, 6: { playerId: 'efimov', role: ROLES.OPPOSITE } } },
      'efimov',
    )

    expect(next.zones[4]).toBeNull()
    expect(next.zones[6]).toBeNull()
    expect(next.liberoId).toBeNull()
    expect(next.zones[1]).toEqual({ playerId: 'belov', role: ROLES.SETTER })
  })

  it('does not mutate the lineup', () => {
    removePlayerFromLineup(lineup, 'belov')

    expect(lineup.zones[1]).toEqual({ playerId: 'belov', role: ROLES.SETTER })
  })
})

describe('applyRoleChange', () => {
  it('updates only the role snapshots that still use the old role', () => {
    const lineup = lineupFrom({
      1: { playerId: 'efimov', role: ROLES.OPPOSITE },
      4: { playerId: 'efimov', role: ROLES.OUTSIDE_HITTER },
    })

    const next = applyRoleChange(lineup, 'efimov', ROLES.OPPOSITE, ROLES.OUTSIDE_HITTER)

    expect(next.zones[1].role).toBe(ROLES.OUTSIDE_HITTER)
    expect(next.zones[4].role).toBe(ROLES.OUTSIDE_HITTER)
  })

  it('preserves an explicit override of another role', () => {
    const lineup = lineupFrom({ 1: { playerId: 'efimov', role: ROLES.SETTER } })

    const next = applyRoleChange(lineup, 'efimov', ROLES.OPPOSITE, ROLES.OUTSIDE_HITTER)

    expect(next.zones[1].role).toBe(ROLES.SETTER)
  })

  it('clears the libero slot when the player stops being a libero', () => {
    const lineup = lineupFrom({}, 'zimin')

    expect(applyRoleChange(lineup, 'zimin', ROLES.LIBERO, ROLES.OUTSIDE_HITTER).liberoId).toBeNull()
  })

  it('removes the player from the zones when they become a libero', () => {
    const lineup = lineupFrom({ 1: { playerId: 'efimov', role: ROLES.OPPOSITE } })

    const next = applyRoleChange(lineup, 'efimov', ROLES.OPPOSITE, ROLES.LIBERO)

    expect(next.zones[1]).toBeNull()
  })
})

describe('reconcileLineup', () => {
  it('drops unknown players, liberos in zones and invalid roles', () => {
    const lineup = lineupFrom(
      {
        1: { playerId: 'ghost', role: ROLES.SETTER },
        2: { playerId: 'zimin', role: ROLES.OUTSIDE_HITTER },
        3: { playerId: 'morozov', role: 'coach' },
        4: { playerId: 'efimov', role: ROLES.OPPOSITE },
      },
      'belov',
    )

    const next = reconcileLineup(lineup, MOCK_ROSTER)

    expect(next.zones[1]).toBeNull()
    expect(next.zones[2]).toBeNull()
    expect(next.zones[3]).toEqual({ playerId: 'morozov', role: ROLES.MIDDLE_BLOCKER })
    expect(next.zones[4]).toEqual({ playerId: 'efimov', role: ROLES.OPPOSITE })
    expect(next.liberoId).toBeNull()
  })

  it('keeps a valid libero and fills missing zones with null', () => {
    const next = reconcileLineup({ zones: { 1: null }, liberoId: 'zimin' }, MOCK_ROSTER)

    expect(next.zones).toEqual(emptyZones())
    expect(next.liberoId).toBe('zimin')
  })
})
