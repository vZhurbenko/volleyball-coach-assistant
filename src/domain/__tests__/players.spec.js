import { describe, it, expect } from 'vitest'

import { ROLES } from '../constants.js'
import { findPlayer } from '../players.js'

const ROSTER = [
  {
    id: 'petrov',
    firstName: 'Иван',
    lastName: 'Петров',
    number: 7,
    role: ROLES.SETTER,
  },
]

describe('findPlayer', () => {
  it('finds a player by id', () => {
    expect(findPlayer(ROSTER, 'petrov')).toBe(ROSTER[0])
  })

  it('returns undefined for an unknown id', () => {
    expect(findPlayer(ROSTER, 'no-such-player')).toBeUndefined()
  })
})
