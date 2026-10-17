import { describe, it, expect } from 'vitest'

import { MATCH_RULES, ZONES } from '../constants.js'
import { defaultLineup } from '../lineup.js'
import { MOCK_ROSTER } from './fixtures/roster.js'
import {
  SUBSTITUTION_MODES,
  initSubstitutions,
  playerInSlot,
  substitute,
  substitutionsLeft,
} from '../substitutions.js'

/** Шестёрка базы 5-1: зона 1 — Белов, 2 — Соколов, 3 — Морозов, 4 — Ефимов, 5 — Лебедев, 6 — Волков. */
const SIX = defaultLineup(MOCK_ROSTER)

/** Делает замену и возвращает новое состояние; падает, если ядро отказало. */
function swap(state, outgoingId, incomingId) {
  const result = substitute(state, { outgoingId, incomingId })
  expect(result.ok, `замена ${outgoingId} → ${incomingId}: ${result.reason?.message}`).toBe(true)
  return result.state
}

/** Прямой обмен и возврат: две замены из шести. */
function swapAndReturn(state, starterId, substituteId) {
  return swap(swap(state, starterId, substituteId), substituteId, starterId)
}

/** Исключительная замена; падает, если ядро отказало. */
function swapExceptional(state, outgoingId, incomingId) {
  const result = substitute(state, { outgoingId, incomingId, exceptional: true })
  expect(
    result.ok,
    `исключительная замена ${outgoingId} → ${incomingId}: ${result.reason?.message}`,
  ).toBe(true)
  return result.state
}

/** Партия, в которой лимит шести замен уже израсходован. */
function spentLimit() {
  let state = initSubstitutions(SIX)
  state = swapAndReturn(state, 'morozov', 'tikhonov')
  state = swapAndReturn(state, 'sokolov', 'gusev')
  state = swapAndReturn(state, 'lebedev', 'orlov')
  return state
}

describe('initSubstitutions', () => {
  it('puts the starting six on court', () => {
    const state = initSubstitutions(SIX)
    for (const zone of ZONES) {
      expect(state.slots[zone]).toEqual({
        starterId: SIX.zones[zone].playerId,
        substituteId: null,
        onCourt: 'starter',
        starterReentered: false,
      })
    }
  })

  it('gives the full substitution limit for the set', () => {
    expect(substitutionsLeft(initSubstitutions(SIX))).toBe(MATCH_RULES.SUBSTITUTIONS_PER_SET)
  })
})

describe('substitutionsLeft', () => {
  it('counts down with every substitution', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(substitutionsLeft(state)).toBe(MATCH_RULES.SUBSTITUTIONS_PER_SET - 1)
  })
})

describe('substitute', () => {
  it('brings a substitute in for the starter', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.slots[3].substituteId).toBe('tikhonov')
    expect(state.slots[3].onCourt).toBe('substitute')
    expect(state.used).toBe(1)
  })

  it('brings the starter back to the same slot', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const back = swap(state, 'tikhonov', 'morozov')

    expect(back.slots[3].onCourt).toBe('starter')
    expect(back.slots[3].starterReentered).toBe(true)
  })

  it('counts the exchange and the return as two substitutions', () => {
    const state = swapAndReturn(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.used).toBe(2)
    expect(substitutionsLeft(state)).toBe(MATCH_RULES.SUBSTITUTIONS_PER_SET - 2)
  })

  it('runs substitutions in different slots independently', () => {
    const first = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const second = swap(first, 'sokolov', 'gusev')

    expect(second.slots[3].substituteId).toBe('tikhonov')
    expect(second.slots[2].substituteId).toBe('gusev')
    expect(second.used).toBe(2)
  })

  it('counts every substitution of one stop separately', () => {
    const state = swap(swap(initSubstitutions(SIX), 'morozov', 'tikhonov'), 'sokolov', 'gusev')
    expect(state.used).toBe(2)
  })

  it('refuses an outgoing player who is not on court', () => {
    const result = substitute(initSubstitutions(SIX), {
      outgoingId: 'krylov',
      incomingId: 'tikhonov',
    })
    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('PLAYER_NOT_ON_COURT')
  })

  it('refuses an incoming player who is already on court', () => {
    const result = substitute(initSubstitutions(SIX), {
      outgoingId: 'morozov',
      incomingId: 'volkov',
    })
    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('PLAYER_ALREADY_ON_COURT')
  })

  it('refuses a third player while the paired substitute is on court', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const result = substitute(state, { outgoingId: 'tikhonov', incomingId: 'orlov' })

    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('ONLY_STARTER_RETURNS')
  })

  it('refuses to send a returned starter out again', () => {
    const state = swapAndReturn(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const result = substitute(state, { outgoingId: 'morozov', incomingId: 'tikhonov' })

    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('PAIR_EXHAUSTED')
  })

  it('refuses a substitution once the limit of six is spent', () => {
    const state = spentLimit()
    expect(substitutionsLeft(state)).toBe(0)

    const result = substitute(state, { outgoingId: 'volkov', incomingId: 'krylov' })
    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('SUBSTITUTION_LIMIT_REACHED')
  })

  it('leaves the state alone when it refuses', () => {
    const state = initSubstitutions(SIX)
    const snapshot = structuredClone(state)
    const result = substitute(state, { outgoingId: 'krylov', incomingId: 'tikhonov' })

    expect(result.state).toBeUndefined()
    expect(state).toEqual(snapshot)
  })

  it('explains every refusal in plain Russian', () => {
    const refusals = [
      substitute(initSubstitutions(SIX), { outgoingId: 'krylov', incomingId: 'tikhonov' }),
      substitute(initSubstitutions(SIX), { outgoingId: 'morozov', incomingId: 'volkov' }),
    ]

    for (const { reason } of refusals) {
      expect(reason.message).toMatch(/[А-Яа-я]/)
    }
  })
})

describe('exceptional substitution', () => {
  it('goes through when the limit of six is spent', () => {
    const result = substitute(spentLimit(), {
      outgoingId: 'volkov',
      incomingId: 'krylov',
      exceptional: true,
    })
    expect(result.ok).toBe(true)
  })

  it('does not spend the substitution limit', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const after = swapExceptional(state, 'volkov', 'krylov')

    expect(substitutionsLeft(after)).toBe(MATCH_RULES.SUBSTITUTIONS_PER_SET - 1)
  })

  it('retires the replaced player for the rest of the match', () => {
    const state = swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.retired).toEqual(['morozov'])
  })

  it('hands the position to the player who came in', () => {
    const state = swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.slots[3]).toEqual({
      starterId: 'tikhonov',
      substituteId: null,
      onCourt: 'starter',
      starterReentered: false,
    })
  })

  it('records the substitution for the summary', () => {
    const state = swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.exceptional).toEqual([{ outgoingId: 'morozov', incomingId: 'tikhonov' }])
  })

  it('keeps ordinary substitutions out of the record', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    expect(state.exceptional).toEqual([])
  })

  it('refuses to bring a retired player back', () => {
    const state = swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const result = substitute(state, { outgoingId: 'sokolov', incomingId: 'morozov' })

    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('PLAYER_RETIRED')
  })

  it('keeps the retired player out in the next set', () => {
    const state = swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const nextSet = initSubstitutions(SIX, state)
    const result = substitute(nextSet, { outgoingId: 'sokolov', incomingId: 'morozov' })

    expect(nextSet.retired).toEqual(['morozov'])
    expect(result.reason.code).toBe('PLAYER_RETIRED')
  })

  it('starts the first set with nobody retired', () => {
    const state = initSubstitutions(SIX)
    expect(state.retired).toEqual([])
    expect(state.exceptional).toEqual([])
  })

  it('gives the next set the full limit again', () => {
    const state = swapExceptional(spentLimit(), 'volkov', 'krylov')
    expect(substitutionsLeft(initSubstitutions(SIX, state))).toBe(MATCH_RULES.SUBSTITUTIONS_PER_SET)
  })

  it('leaves ordinary substitutions working afterwards', () => {
    const after = swap(
      swapExceptional(initSubstitutions(SIX), 'morozov', 'tikhonov'),
      'sokolov',
      'gusev',
    )

    expect(after.slots[2].substituteId).toBe('gusev')
    expect(after.used).toBe(1)
  })

  it('works for a substitute who is on court', () => {
    const state = swap(initSubstitutions(SIX), 'morozov', 'tikhonov')
    const after = swapExceptional(state, 'tikhonov', 'gusev')

    expect(after.retired).toEqual(['tikhonov'])
    expect(after.slots[3].starterId).toBe('gusev')
  })

  it('still refuses an outgoing player who is not on court', () => {
    const result = substitute(initSubstitutions(SIX), {
      outgoingId: 'krylov',
      incomingId: 'tikhonov',
      exceptional: true,
    })
    expect(result.reason.code).toBe('PLAYER_NOT_ON_COURT')
  })

  it('still refuses an incoming player who is already on court', () => {
    const result = substitute(initSubstitutions(SIX), {
      outgoingId: 'morozov',
      incomingId: 'volkov',
      exceptional: true,
    })
    expect(result.reason.code).toBe('PLAYER_ALREADY_ON_COURT')
  })
})

describe('count-only mode', () => {
  /** Замена в любительском режиме: только лимит и кто где находится. */
  function swapCount(state, outgoingId, incomingId) {
    const result = substitute(state, {
      outgoingId,
      incomingId,
      mode: SUBSTITUTION_MODES.COUNT,
    })
    expect(result.ok, `замена ${outgoingId} → ${incomingId}: ${result.reason?.message}`).toBe(true)
    return result.state
  }

  it('lets a third player take the position, ignoring the pair rules', () => {
    let state = initSubstitutions(SIX)
    state = swapCount(state, 'morozov', 'tikhonov')
    state = swapCount(state, 'tikhonov', 'gusev')

    expect(playerInSlot(state, 3)).toBe('gusev')
    expect(state.used).toBe(2)
  })

  it('still stops at the substitution limit', () => {
    const spent = { ...initSubstitutions(SIX), used: MATCH_RULES.SUBSTITUTIONS_PER_SET }

    const result = substitute(spent, {
      outgoingId: 'morozov',
      incomingId: 'tikhonov',
      mode: SUBSTITUTION_MODES.COUNT,
    })

    expect(result.ok).toBe(false)
    expect(result.reason.code).toBe('SUBSTITUTION_LIMIT_REACHED')
  })

  it('keeps everyone in the match — no retirement', () => {
    const state = swapCount(initSubstitutions(SIX), 'morozov', 'tikhonov')

    expect(state.retired).toEqual([])
    expect(state.exceptional).toEqual([])
  })
})
