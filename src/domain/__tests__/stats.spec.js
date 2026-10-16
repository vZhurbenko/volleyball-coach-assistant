import { describe, it, expect } from 'vitest'

import {
  STAT_LABELS,
  STAT_TYPES,
  addStat,
  countersForPlayer,
  countersForSet,
  emptyCounters,
  initStats,
} from '../stats.js'

const FACT = (setNumber, playerId, type) => ({ setNumber, playerId, type })

/** Партия 1: Белов +очко, партия 2: Белов два блока, Морозов +подача. */
function twoSetsOfFacts() {
  let stats = initStats()
  stats = addStat(stats, FACT(1, 'belov', STAT_TYPES.POINT))
  stats = addStat(stats, FACT(2, 'belov', STAT_TYPES.BLOCK))
  stats = addStat(stats, FACT(2, 'belov', STAT_TYPES.BLOCK))
  stats = addStat(stats, FACT(2, 'morozov', STAT_TYPES.SERVE))
  return stats
}

describe('STAT_TYPES', () => {
  it('holds the five match facts', () => {
    expect(Object.values(STAT_TYPES)).toEqual(['point', 'serve', 'serve_error', 'error', 'block'])
  })

  it('labels every fact for the player menu', () => {
    for (const type of Object.values(STAT_TYPES)) {
      expect(STAT_LABELS[type]).toMatch(/[А-Яа-я]/)
    }
  })
})

describe('emptyCounters', () => {
  it('zeroes every counter', () => {
    expect(emptyCounters()).toEqual({
      point: 0,
      serve: 0,
      serve_error: 0,
      error: 0,
      block: 0,
    })
  })
})

describe('addStat', () => {
  it('keeps counters independent', () => {
    for (const type of Object.values(STAT_TYPES)) {
      const counters = countersForPlayer(addStat(initStats(), FACT(1, 'belov', type)), 'belov')

      expect(counters[type]).toBe(1)
      for (const other of Object.values(STAT_TYPES).filter((each) => each !== type)) {
        expect(counters[other]).toBe(0)
      }
    }
  })

  it('counts repeated taps of the same fact', () => {
    let stats = initStats()
    stats = addStat(stats, FACT(1, 'belov', STAT_TYPES.SERVE))
    stats = addStat(stats, FACT(1, 'belov', STAT_TYPES.SERVE))

    expect(countersForSet(stats, 1).belov.serve).toBe(2)
  })

  it('opens a set that has no facts yet', () => {
    const stats = addStat(initStats(), FACT(3, 'belov', STAT_TYPES.POINT))
    expect(countersForSet(stats, 3).belov.point).toBe(1)
  })

  it('leaves the previous stats untouched', () => {
    const before = initStats()
    const snapshot = structuredClone(before)
    addStat(before, FACT(1, 'belov', STAT_TYPES.POINT))

    expect(before).toEqual(snapshot)
  })

  it('counts players apart', () => {
    const stats = twoSetsOfFacts()
    expect(countersForPlayer(stats, 'morozov')).toEqual({ ...emptyCounters(), serve: 1 })
  })
})

describe('countersForSet', () => {
  it('breaks the match stats down by set', () => {
    const stats = twoSetsOfFacts()

    expect(countersForSet(stats, 1).belov).toEqual({ ...emptyCounters(), point: 1 })
    expect(countersForSet(stats, 2).belov).toEqual({ ...emptyCounters(), block: 2 })
  })

  it('has nothing for a set that was never played', () => {
    expect(countersForSet(twoSetsOfFacts(), 4)).toEqual({})
  })
})

describe('countersForPlayer', () => {
  it('sums the sets of the match', () => {
    const stats = twoSetsOfFacts()
    expect(countersForPlayer(stats, 'belov')).toEqual({ ...emptyCounters(), point: 1, block: 2 })
  })

  it('gives zeroes for a player without stats', () => {
    expect(countersForPlayer(twoSetsOfFacts(), 'zimin')).toEqual(emptyCounters())
  })

  it('gives zeroes for a player in a match that has not started', () => {
    expect(countersForPlayer(initStats(), 'belov')).toEqual(emptyCounters())
  })
})
