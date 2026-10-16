import { describe, it, expect } from 'vitest'

import { TEAMS } from '../score.js'
import { pointStreaks } from '../streaks.js'

/** Очко в истории: кто взял и в какой партии. */
const point = (setNumber, team) => ({ setNumber, team })

const US = TEAMS.US
const THEM = TEAMS.THEM

describe('pointStreaks', () => {
  it('groups consecutive points of one team', () => {
    const history = [point(1, THEM), point(1, THEM), point(1, THEM), point(1, US), point(1, US)]

    expect(pointStreaks(history)).toEqual([
      { setNumber: 1, team: THEM, points: 3 },
      { setNumber: 1, team: US, points: 2 },
    ])
  })

  it('makes a streak of a single point', () => {
    expect(pointStreaks([point(1, US)])).toEqual([{ setNumber: 1, team: US, points: 1 }])
  })

  it('has no streaks without points', () => {
    expect(pointStreaks([])).toEqual([])
  })

  it('closes a streak at the set boundary', () => {
    const history = [point(1, US), point(1, US), point(2, US)]

    expect(pointStreaks(history)).toEqual([
      { setNumber: 1, team: US, points: 2 },
      { setNumber: 2, team: US, points: 1 },
    ])
  })

  it('starts a new streak when the team changes', () => {
    const history = [point(1, US), point(1, THEM), point(1, THEM), point(1, US)]

    expect(pointStreaks(history)).toEqual([
      { setNumber: 1, team: US, points: 1 },
      { setNumber: 1, team: THEM, points: 2 },
      { setNumber: 1, team: US, points: 1 },
    ])
  })

  it('keeps the sets of the match apart', () => {
    const history = [point(1, US), point(1, US), point(1, THEM), point(2, THEM), point(2, US)]

    expect(pointStreaks(history)).toEqual([
      { setNumber: 1, team: US, points: 2 },
      { setNumber: 1, team: THEM, points: 1 },
      { setNumber: 2, team: THEM, points: 1 },
      { setNumber: 2, team: US, points: 1 },
    ])
  })

  it('recomputes after the last point is undone', () => {
    const history = [point(1, US), point(1, US), point(1, THEM)]
    expect(pointStreaks(history)).toHaveLength(2)

    expect(pointStreaks(history.slice(0, -1))).toEqual([{ setNumber: 1, team: US, points: 2 }])
  })

  it('recomputes after a point that closed the set is undone', () => {
    const history = [point(1, US), point(1, US), point(2, US)]

    expect(pointStreaks(history.slice(0, -1))).toEqual([{ setNumber: 1, team: US, points: 2 }])
  })

  it('leaves the history untouched', () => {
    const history = [point(1, US), point(1, US)]
    const snapshot = structuredClone(history)

    pointStreaks(history)

    expect(history).toEqual(snapshot)
  })
})
