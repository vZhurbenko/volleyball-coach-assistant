import { describe, it, expect } from 'vitest'

import { ROLES, ZONES } from '../constants.js'
import { findPlayer } from '../players.js'
import { MOCK_ROSTER } from './fixtures/roster.js'
import { defaultLineup, emptyLineup, availablePlayersForZone, validateLineup } from '../lineup.js'

/** Карта пустых зон: { 1: null, …, 6: null }. */
function emptyZones() {
  return Object.fromEntries(ZONES.map((zone) => [zone, null]))
}

/**
 * Собирает расстановку из карты «зона → игрок». Значение — id игрока,
 * либо пара [id, роль], когда роль переопределена при назначении.
 */
function lineupFrom(assignments, liberoId = null) {
  const zones = emptyZones()
  for (const [zone, value] of Object.entries(assignments)) {
    const [playerId, role] = Array.isArray(value)
      ? value
      : [value, findPlayer(MOCK_ROSTER, value).role]
    zones[zone] = { playerId, role }
  }
  return { zones, liberoId }
}

const codesOf = (result) => result.violations.map((violation) => violation.code)

const countOf = (playerRole) =>
  Object.values(defaultLineup(MOCK_ROSTER).zones).filter((zone) => zone.role === playerRole).length

/** Валидная шестёрка базы 5-1: связка, два доигровщика, диагональный, два ЦБ. */
const VALID_SIX = {
  1: 'belov',
  2: 'sokolov',
  3: 'morozov',
  4: 'efimov',
  5: 'lebedev',
  6: 'volkov',
}

describe('emptyLineup', () => {
  it('leaves every zone and the libero slot empty', () => {
    const lineup = emptyLineup()
    expect(lineup.zones).toEqual(emptyZones())
    expect(lineup.liberoId).toBeNull()
  })
})

describe('defaultLineup', () => {
  it('fills all six zones with roster players', () => {
    const { zones } = defaultLineup(MOCK_ROSTER)
    for (const zone of ZONES) {
      expect(findPlayer(MOCK_ROSTER, zones[zone].playerId)).toBeDefined()
    }
  })

  it('keeps the role limits of the six', () => {
    expect(countOf(ROLES.SETTER)).toBe(1)
    expect(countOf(ROLES.OPPOSITE)).toBe(1)
    expect(countOf(ROLES.OUTSIDE_HITTER)).toBe(2)
    expect(countOf(ROLES.MIDDLE_BLOCKER)).toBe(2)
    expect(countOf(ROLES.LIBERO)).toBe(0)
  })

  it('passes validation', () => {
    expect(validateLineup(defaultLineup(MOCK_ROSTER), MOCK_ROSTER).valid).toBe(true)
  })
})

describe('availablePlayersForZone', () => {
  it('excludes players assigned to other zones', () => {
    const available = availablePlayersForZone(lineupFrom(VALID_SIX), MOCK_ROSTER, 4)
    const ids = available.map((player) => player.id)

    expect(ids).not.toContain('belov')
    expect(ids).not.toContain('sokolov')
    expect(ids).not.toContain('morozov')
    expect(ids).not.toContain('lebedev')
    expect(ids).not.toContain('volkov')
  })

  it('keeps the player already assigned to this zone', () => {
    const available = availablePlayersForZone(lineupFrom(VALID_SIX), MOCK_ROSTER, 4)

    expect(available.map((player) => player.id)).toContain('efimov')
  })

  it('returns the whole roster for an empty lineup', () => {
    expect(availablePlayersForZone(emptyLineup(), MOCK_ROSTER, 3)).toEqual(MOCK_ROSTER)
  })
})

describe('validateLineup', () => {
  it('accepts a filled valid six', () => {
    const result = validateLineup(lineupFrom(VALID_SIX), MOCK_ROSTER)
    expect(result.violations).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('rejects an empty zone and names it', () => {
    const withoutZone5 = { ...VALID_SIX }
    delete withoutZone5[5]

    const { violations } = validateLineup(lineupFrom(withoutZone5), MOCK_ROSTER)
    expect(violations).toHaveLength(1)
    expect(violations[0].code).toBe('EMPTY_ZONE')
    expect(violations[0].zone).toBe(5)
    expect(violations[0].message).toContain('Зона 5')
  })

  it('reports every empty zone of an empty lineup', () => {
    const result = validateLineup(emptyLineup(), MOCK_ROSTER)
    expect(codesOf(result)).toEqual(Array(ZONES.length).fill('EMPTY_ZONE'))
    expect(result.valid).toBe(false)
  })

  it('rejects the same player in two zones', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 2: 'belov' }), MOCK_ROSTER)
    expect(codesOf(result)).toContain('DUPLICATE_PLAYER')
    expect(result.valid).toBe(false)
  })

  it('rejects three middle blockers', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 4: 'tikhonov' }), MOCK_ROSTER)
    expect(codesOf(result)).toContain('TOO_MANY_MIDDLE_BLOCKERS')
  })

  it('rejects three outside hitters', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 4: 'gusev' }), MOCK_ROSTER)
    expect(codesOf(result)).toContain('TOO_MANY_OUTSIDE_HITTERS')
    expect(result.valid).toBe(false)
  })

  it('rejects two opposites', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 5: 'savelev' }), MOCK_ROSTER)
    expect(codesOf(result)).toContain('TOO_MANY_OPPOSITES')
    expect(result.valid).toBe(false)
  })

  it('accepts two setters without an opposite', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 4: 'krylov' }), MOCK_ROSTER)
    expect(result.valid).toBe(true)
  })

  it('rejects two setters next to an opposite', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 2: 'krylov' }), MOCK_ROSTER)
    expect(codesOf(result)).toContain('TOO_MANY_SETTERS')
    expect(result.valid).toBe(false)
  })

  it('counts the role overridden on assignment', () => {
    const result = validateLineup(
      lineupFrom({ ...VALID_SIX, 4: ['efimov', ROLES.MIDDLE_BLOCKER] }),
      MOCK_ROSTER,
    )
    expect(codesOf(result)).toContain('TOO_MANY_MIDDLE_BLOCKERS')
  })

  it('accepts an override that makes the six legal', () => {
    const result = validateLineup(
      lineupFrom({ ...VALID_SIX, 2: ['krylov', ROLES.OUTSIDE_HITTER] }),
      MOCK_ROSTER,
    )
    expect(result.valid).toBe(true)
  })

  it('accepts a libero from the roster', () => {
    const result = validateLineup(lineupFrom(VALID_SIX, 'zimin'), MOCK_ROSTER)
    expect(result.valid).toBe(true)
  })

  it('rejects a libero slot filled by a non-libero', () => {
    const result = validateLineup(lineupFrom(VALID_SIX, 'sokolov'), MOCK_ROSTER)
    expect(codesOf(result)).toContain('NOT_A_LIBERO')
    expect(result.valid).toBe(false)
  })

  it('explains every violation in plain Russian', () => {
    const result = validateLineup(lineupFrom({ ...VALID_SIX, 2: 'krylov' }, 'sokolov'), MOCK_ROSTER)
    expect(result.violations.length).toBeGreaterThan(1)
    for (const violation of result.violations) {
      expect(violation.code).toBeTruthy()
      expect(violation.message).toMatch(/[А-Яа-я]/)
    }
  })
})
