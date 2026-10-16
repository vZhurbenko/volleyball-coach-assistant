import { describe, it, expect } from 'vitest'

import {
  TEAMS,
  addPoint,
  currentSet,
  initialScore,
  isMatchOver,
  isSetOver,
  matchWinner,
  pointsToWin,
  setWinner,
  setsWon,
  startNextSet,
} from '../score.js'

/** Партия с готовым счётом. */
function set(number, us, them) {
  return { number, points: { us, them } }
}

/** Матч из готовых партий; последняя партия — текущая. */
function match(sets, serving = TEAMS.US) {
  return { sets, serving }
}

describe('pointsToWin', () => {
  it('is 25 for regular sets', () => {
    for (const number of [1, 2, 3, 4]) {
      expect(pointsToWin(number)).toBe(25)
    }
  })

  it('is 15 for the tiebreak', () => {
    expect(pointsToWin(5)).toBe(15)
  })
})

describe('isSetOver', () => {
  it('ends a set at 25:23', () => {
    expect(isSetOver(set(1, 25, 23))).toBe(true)
  })

  it('keeps playing at 24:25', () => {
    expect(isSetOver(set(1, 24, 25))).toBe(false)
  })

  it('ends a set at 26:24', () => {
    expect(isSetOver(set(1, 26, 24))).toBe(true)
  })

  it('keeps playing while the lead is one point', () => {
    expect(isSetOver(set(1, 25, 24))).toBe(false)
    expect(isSetOver(set(1, 26, 25))).toBe(false)
  })

  it('keeps playing at 24:24', () => {
    expect(isSetOver(set(2, 24, 24))).toBe(false)
  })

  it('ends the tiebreak at 15:13', () => {
    expect(isSetOver(set(5, 15, 13))).toBe(true)
  })

  it('keeps playing the tiebreak at 14:15', () => {
    expect(isSetOver(set(5, 14, 15))).toBe(false)
  })

  it('keeps playing the tiebreak while the lead is one point', () => {
    expect(isSetOver(set(5, 15, 14))).toBe(false)
    expect(isSetOver(set(5, 16, 15))).toBe(false)
  })

  it('ends the tiebreak at 16:14', () => {
    expect(isSetOver(set(5, 16, 14))).toBe(true)
  })
})

describe('setWinner', () => {
  it('names us when we are ahead at the end', () => {
    expect(setWinner(set(1, 25, 20))).toBe(TEAMS.US)
  })

  it('names the opponent', () => {
    expect(setWinner(set(1, 20, 25))).toBe(TEAMS.THEM)
  })

  it('is null while the set goes on', () => {
    expect(setWinner(set(1, 24, 23))).toBeNull()
  })
})

describe('setsWon', () => {
  it('counts the sets each team has taken', () => {
    const score = match([set(1, 25, 20), set(2, 20, 25), set(3, 25, 22)])
    expect(setsWon(score)).toEqual({ us: 2, them: 1 })
  })

  it('does not count the running set', () => {
    expect(setsWon(match([set(1, 12, 8)]))).toEqual({ us: 0, them: 0 })
  })
})

describe('match end', () => {
  it('ends the match at 3:0', () => {
    const score = match([set(1, 25, 20), set(2, 25, 20), set(3, 25, 20)])
    expect(isMatchOver(score)).toBe(true)
    expect(matchWinner(score)).toBe(TEAMS.US)
  })

  it('ends the match at 3:2', () => {
    const score = match([
      set(1, 25, 20),
      set(2, 20, 25),
      set(3, 25, 22),
      set(4, 22, 25),
      set(5, 15, 12),
    ])
    expect(isMatchOver(score)).toBe(true)
    expect(matchWinner(score)).toBe(TEAMS.US)
  })

  it('keeps the match going at 2:2', () => {
    const score = match([set(1, 25, 20), set(2, 20, 25), set(3, 25, 22), set(4, 22, 25)])
    expect(isMatchOver(score)).toBe(false)
    expect(matchWinner(score)).toBeNull()
  })
})

describe('initialScore', () => {
  it('opens the first set with the given server', () => {
    const score = initialScore(TEAMS.THEM)
    expect(score.serving).toBe(TEAMS.THEM)
    expect(score.sets).toEqual([set(1, 0, 0)])
  })
})

describe('addPoint', () => {
  it('adds a point to the scoring team', () => {
    const score = addPoint(initialScore(TEAMS.US), TEAMS.US)
    expect(currentSet(score).points).toEqual({ us: 1, them: 0 })
  })

  it('hands the serve to the team that scored', () => {
    const score = addPoint(initialScore(TEAMS.US), TEAMS.THEM)
    expect(score.serving).toBe(TEAMS.THEM)
  })

  it('leaves the previous score untouched', () => {
    const before = initialScore(TEAMS.US)
    addPoint(before, TEAMS.US)
    expect(currentSet(before).points).toEqual({ us: 0, them: 0 })
  })

  it('refuses a point once the set is over', () => {
    const over = match([set(1, 25, 23)])
    expect(addPoint(over, TEAMS.THEM)).toBe(over)
  })

  it('refuses a point once the match is over', () => {
    const over = match([set(1, 25, 20), set(2, 25, 20), set(3, 25, 20)])
    expect(addPoint(over, TEAMS.US)).toBe(over)
  })
})

describe('startNextSet', () => {
  it('opens the next set with empty points', () => {
    const next = startNextSet(match([set(1, 25, 23)]), TEAMS.THEM)
    expect(next.sets.map((each) => each.number)).toEqual([1, 2])
    expect(currentSet(next)).toEqual(set(2, 0, 0))
    expect(next.serving).toBe(TEAMS.THEM)
  })

  it('keeps the finished sets', () => {
    const next = startNextSet(match([set(1, 25, 23)]), TEAMS.THEM)
    expect(next.sets[0]).toEqual(set(1, 25, 23))
    expect(setsWon(next)).toEqual({ us: 1, them: 0 })
  })

  it('does nothing while the running set is unfinished', () => {
    const running = match([set(1, 12, 8)])
    expect(startNextSet(running, TEAMS.THEM)).toBe(running)
  })

  it('does nothing once the match is over', () => {
    const over = match([set(1, 25, 20), set(2, 25, 20), set(3, 25, 20)])
    expect(startNextSet(over, TEAMS.THEM)).toBe(over)
  })
})
