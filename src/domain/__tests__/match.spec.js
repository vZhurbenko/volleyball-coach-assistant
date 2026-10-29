import { describe, it, expect } from 'vitest'

import { defaultLineup } from '../lineup.js'
import {
  EVENT_TYPES,
  matchState,
  playersOnCourt,
  substitutionsBySet,
  undoLastPoint,
} from '../match.js'
import { MOCK_ROSTER } from './fixtures/roster.js'
import { TEAMS, currentSet, isSetOver } from '../score.js'

const SIX = defaultLineup(MOCK_ROSTER)

const setStart = (serving = TEAMS.US, lineup = SIX) => ({
  type: EVENT_TYPES.SET_START,
  lineup,
  serving,
})
const point = (team) => ({ type: EVENT_TYPES.POINT, team })
const stat = (playerId, statType) => ({ type: EVENT_TYPES.STAT, playerId, statType })
const substitution = (outgoingId, incomingId, exceptional = false) => ({
  type: EVENT_TYPES.SUBSTITUTION,
  outgoingId,
  incomingId,
  exceptional,
})
const points = (team, count) => Array.from({ length: count }, () => point(team))

/** Партия, закрытая нашими 25:23. */
const closedSet = [setStart(), ...points(TEAMS.US, 24), ...points(TEAMS.THEM, 23), point(TEAMS.US)]

describe('matchState', () => {
  it('has no state without a journal', () => {
    expect(matchState([])).toBeNull()
  })

  it('ignores events that come before the first set', () => {
    expect(matchState([point(TEAMS.US)])).toBeNull()
  })

  it('opens the first set from setStart', () => {
    const state = matchState([setStart(TEAMS.THEM)])

    expect(state.setNumber).toBe(1)
    expect(currentSet(state.score).points).toEqual({ us: 0, them: 0 })
    expect(state.score.serving).toBe(TEAMS.THEM)
  })

  it('puts the whole six on court by its zones', () => {
    const court = playersOnCourt(matchState([setStart()]))

    expect(court).toEqual({
      1: 'belov',
      2: 'sokolov',
      3: 'morozov',
      4: 'efimov',
      5: 'lebedev',
      6: 'volkov',
    })
  })

  it('counts a point', () => {
    const state = matchState([setStart(), point(TEAMS.US)])
    expect(currentSet(state.score).points).toEqual({ us: 1, them: 0 })
  })

  it('leaves the serve with the team that scored on its own serve', () => {
    const state = matchState([setStart(TEAMS.US), point(TEAMS.US)])
    expect(state.score.serving).toBe(TEAMS.US)
  })

  it('gives the serve to the team that took a point on the opponent serve', () => {
    const state = matchState([setStart(TEAMS.THEM), point(TEAMS.US)])
    expect(state.score.serving).toBe(TEAMS.US)
  })

  it('rotates the six when the serve passes to us', () => {
    const state = matchState([setStart(TEAMS.THEM), point(TEAMS.THEM), point(TEAMS.US)])

    expect(state.rotations).toBe(1)
    expect(playersOnCourt(state)[1]).toBe('sokolov')
    expect(playersOnCourt(state)[6]).toBe('belov')
  })

  it('keeps the six in place on our own serve', () => {
    const state = matchState([setStart(TEAMS.US), point(TEAMS.US), point(TEAMS.US)])

    expect(state.rotations).toBe(0)
    expect(playersOnCourt(state)[1]).toBe('belov')
  })

  it('builds the streaks of the match', () => {
    const state = matchState([setStart(), point(TEAMS.THEM), point(TEAMS.THEM), point(TEAMS.US)])

    expect(state.streaks).toEqual([
      { setNumber: 1, team: TEAMS.THEM, points: 2 },
      { setNumber: 1, team: TEAMS.US, points: 1 },
    ])
  })

  it('records a player stat in the running set', () => {
    const state = matchState([setStart(), stat('belov', 'point')])

    expect(state.stats.sets[0].belov.point).toBe(1)
  })

  it('applies a legal substitution to the court', () => {
    const state = matchState([setStart(), substitution('morozov', 'tikhonov')])

    expect(playersOnCourt(state)[3]).toBe('tikhonov')
    expect(state.substitutions.used).toBe(1)
  })

  it('keeps an illegal substitution out of the state', () => {
    const state = matchState([setStart(), substitution('krylov', 'tikhonov')])

    expect(state.substitutions.used).toBe(0)
    expect(playersOnCourt(state)[3]).toBe('morozov')
  })

  it('applies a count-mode substitution without the pair rules', () => {
    const state = matchState([
      setStart(),
      { ...substitution('morozov', 'tikhonov'), mode: 'count' },
      { ...substitution('tikhonov', 'gusev'), mode: 'count' },
    ])

    expect(playersOnCourt(state)[3]).toBe('gusev')
    expect(state.substitutions.used).toBe(2)
  })

  it('moves the substitute with the rotation', () => {
    const state = matchState([
      setStart(TEAMS.THEM),
      substitution('morozov', 'tikhonov'),
      point(TEAMS.THEM),
      point(TEAMS.US),
    ])

    expect(playersOnCourt(state)[2]).toBe('tikhonov')
  })

  it('opens the next set with an empty score', () => {
    const state = matchState([...closedSet, setStart(TEAMS.THEM)])

    expect(state.setNumber).toBe(2)
    expect(state.score.sets).toHaveLength(2)
    expect(currentSet(state.score).points).toEqual({ us: 0, them: 0 })
    expect(state.score.serving).toBe(TEAMS.THEM)
    expect(state.rotations).toBe(0)
  })

  it('keeps the sets of the match', () => {
    const state = matchState([...closedSet, setStart(TEAMS.THEM)])
    expect(state.score.sets[0].points).toEqual({ us: 25, them: 23 })
  })

  it('starts the stats of a new set from zero', () => {
    const state = matchState([
      ...closedSet,
      stat('belov', 'point'),
      setStart(TEAMS.THEM),
      stat('morozov', 'block'),
    ])

    expect(state.stats.sets[0].belov.point).toBe(1)
    expect(state.stats.sets[1].morozov.block).toBe(1)
    expect(state.stats.sets[1].belov).toBeUndefined()
  })

  it('starts the substitutions of a new set from a clean limit', () => {
    const state = matchState([
      ...closedSet,
      substitution('morozov', 'tikhonov'),
      setStart(TEAMS.THEM),
    ])

    expect(state.substitutions.used).toBe(0)
  })
})

describe('playersOnCourt', () => {
  it('follows the rotation of the set', () => {
    const state = matchState([
      setStart(TEAMS.THEM),
      point(TEAMS.THEM),
      point(TEAMS.US),
      point(TEAMS.THEM),
      point(TEAMS.US),
    ])

    expect(state.rotations).toBe(2)
    expect(playersOnCourt(state)).toEqual({
      1: 'morozov',
      2: 'efimov',
      3: 'lebedev',
      4: 'volkov',
      5: 'belov',
      6: 'sokolov',
    })
  })
})

describe('undoLastPoint', () => {
  it('has nothing to undo in a journal without points', () => {
    const journal = [setStart()]
    expect(undoLastPoint(journal)).toEqual(journal)
  })

  it('removes the last point', () => {
    const journal = [setStart(), point(TEAMS.US), point(TEAMS.US)]
    expect(undoLastPoint(journal)).toEqual([setStart(), point(TEAMS.US)])
  })

  it('leaves the given journal alone', () => {
    const journal = [setStart(), point(TEAMS.US)]
    const snapshot = structuredClone(journal)

    undoLastPoint(journal)

    expect(journal).toEqual(snapshot)
  })

  it('takes back the rotation the point brought', () => {
    const journal = [setStart(TEAMS.THEM), point(TEAMS.THEM), point(TEAMS.US)]
    const state = matchState(undoLastPoint(journal))

    expect(state.rotations).toBe(0)
    expect(playersOnCourt(state)[1]).toBe('belov')
  })

  it('keeps the six in place when the point did not rotate it', () => {
    const journal = [setStart(TEAMS.US), point(TEAMS.US), point(TEAMS.US)]
    const state = matchState(undoLastPoint(journal))

    expect(state.rotations).toBe(0)
    expect(currentSet(state.score).points).toEqual({ us: 1, them: 0 })
  })

  it('takes back several points in a row', () => {
    const journal = [setStart(TEAMS.US), point(TEAMS.US), point(TEAMS.THEM), point(TEAMS.US)]
    const state = matchState(undoLastPoint(undoLastPoint(journal)))

    expect(currentSet(state.score).points).toEqual({ us: 1, them: 0 })
    expect(state.score.serving).toBe(TEAMS.US)
  })

  it('brings a finished set back into play', () => {
    expect(isSetOver(currentSet(matchState(closedSet).score))).toBe(true)

    const state = matchState(undoLastPoint(closedSet))

    expect(isSetOver(currentSet(state.score))).toBe(false)
    expect(currentSet(state.score).points).toEqual({ us: 24, them: 23 })
  })

  it('keeps the stats of the undone point', () => {
    const journal = [setStart(), point(TEAMS.US), stat('belov', 'point')]
    const state = matchState(undoLastPoint(journal))

    expect(state.stats.sets[0].belov.point).toBe(1)
    expect(currentSet(state.score).points).toEqual({ us: 0, them: 0 })
  })

  it('keeps the substitutions of the undone point', () => {
    const journal = [setStart(), point(TEAMS.US), substitution('morozov', 'tikhonov')]
    const state = matchState(undoLastPoint(journal))

    expect(state.substitutions.used).toBe(1)
    expect(playersOnCourt(state)[3]).toBe('tikhonov')
  })
})

describe('substitutionsBySet', () => {
  it('groups substitutions by set in journal order', () => {
    const journal = [
      setStart(),
      substitution('belov', 'sokolov'),
      point(TEAMS.US),
      substitution('sokolov', 'morozov', true),
      setStart(TEAMS.THEM),
      substitution('zimin', 'belov'),
    ]

    expect(substitutionsBySet(journal)).toEqual([
      [
        { outgoingId: 'belov', incomingId: 'sokolov', exceptional: false },
        { outgoingId: 'sokolov', incomingId: 'morozov', exceptional: true },
      ],
      [{ outgoingId: 'zimin', incomingId: 'belov', exceptional: false }],
    ])
  })

  it('keeps an empty list for a set without substitutions', () => {
    expect(substitutionsBySet([setStart(), point(TEAMS.US), setStart(TEAMS.THEM)])).toEqual([
      [],
      [],
    ])
  })

  it('ignores substitutions before the first set', () => {
    expect(substitutionsBySet([substitution('belov', 'sokolov'), setStart()])).toEqual([[]])
  })
})
