import { describe, it, expect } from 'vitest'

import { ROLE_LABELS, ROLES, ZONES } from '../constants.js'

describe('constants', () => {
  it('labels every role for the UI', () => {
    for (const role of Object.values(ROLES)) {
      expect(ROLE_LABELS[role]).toBeTruthy()
    }
  })

  it('numbers the court zones from 1 to 6', () => {
    expect(ZONES).toEqual([1, 2, 3, 4, 5, 6])
  })
})
