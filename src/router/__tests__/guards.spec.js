import { describe, it, expect } from 'vitest'

import { createGuards, resumeScreen } from '../guards.js'

/** Минимальное состояние, которого достаточно гвардам: счёт матча. */
function stateWithSets(sets) {
  return { score: { sets, serving: 'us' } }
}

const IN_PROGRESS = stateWithSets([{ number: 1, points: { us: 3, them: 2 } }])

const BETWEEN_SETS = stateWithSets([{ number: 1, points: { us: 25, them: 10 } }])

const FINISHED = stateWithSets([
  { number: 1, points: { us: 25, them: 10 } },
  { number: 2, points: { us: 25, them: 10 } },
  { number: 3, points: { us: 25, them: 10 } },
])

describe('resumeScreen', () => {
  it('starts from the lineup when there is no match', () => {
    expect(resumeScreen(null)).toBe('lineup')
  })

  it('returns to the match while it is in progress', () => {
    expect(resumeScreen(IN_PROGRESS)).toBe('match')
  })

  it('returns to the lineup between sets', () => {
    expect(resumeScreen(BETWEEN_SETS)).toBe('lineup')
  })

  it('returns to the summary once the match is over', () => {
    expect(resumeScreen(FINISHED)).toBe('summary')
  })
})

describe('resume guard', () => {
  it('lets the lineup screen open before a match', () => {
    const { resume } = createGuards(() => null)

    expect(resume({ name: 'lineup' })).toBe(true)
  })

  it('takes the coach to the match in progress', () => {
    const { resume } = createGuards(() => IN_PROGRESS)

    expect(resume({ name: 'lineup' })).toEqual({ name: 'match' })
  })

  it('keeps the coach on the lineup between sets', () => {
    const { resume } = createGuards(() => BETWEEN_SETS)

    expect(resume({ name: 'lineup' })).toBe(true)
  })

  it('takes the coach to the summary of a finished match', () => {
    const { resume } = createGuards(() => FINISHED)

    expect(resume({ name: 'lineup' })).toEqual({ name: 'summary' })
  })
})

describe('set-result guard', () => {
  it('blocks the set result without a match', () => {
    const { requireSetResult } = createGuards(() => null)

    expect(requireSetResult()).toEqual({ name: 'lineup' })
  })

  it('keeps the coach on the match while the set is running', () => {
    const { requireSetResult } = createGuards(() => IN_PROGRESS)

    expect(requireSetResult()).toEqual({ name: 'match' })
  })

  it('allows the result between sets', () => {
    const { requireSetResult } = createGuards(() => BETWEEN_SETS)

    expect(requireSetResult()).toBe(true)
  })

  it('sends the coach to the summary after the match', () => {
    const { requireSetResult } = createGuards(() => FINISHED)

    expect(requireSetResult()).toEqual({ name: 'summary' })
  })
})

describe('match guard', () => {
  it('blocks the match screen until a match is started', () => {
    const { requireMatch } = createGuards(() => null)

    expect(requireMatch()).toEqual({ name: 'lineup' })
  })

  it('allows the match screen once the match is started', () => {
    const { requireMatch } = createGuards(() => IN_PROGRESS)

    expect(requireMatch()).toBe(true)
  })
})

describe('roster guard', () => {
  it('allows editing the roster before the match', () => {
    const { requireNoMatch } = createGuards(() => null)

    expect(requireNoMatch()).toBe(true)
  })

  it('takes the coach to the match in progress', () => {
    const { requireNoMatch } = createGuards(() => IN_PROGRESS)

    expect(requireNoMatch()).toEqual({ name: 'match' })
  })

  it('takes the coach to the lineup between sets', () => {
    const { requireNoMatch } = createGuards(() => BETWEEN_SETS)

    expect(requireNoMatch()).toEqual({ name: 'lineup' })
  })

  it('takes the coach to the summary after the match', () => {
    const { requireNoMatch } = createGuards(() => FINISHED)

    expect(requireNoMatch()).toEqual({ name: 'summary' })
  })
})

describe('summary guard', () => {
  it('blocks the summary until a match is started', () => {
    const { requireFinishedMatch } = createGuards(() => null)

    expect(requireFinishedMatch()).toEqual({ name: 'lineup' })
  })

  it('keeps the coach on the match until it is over', () => {
    const { requireFinishedMatch } = createGuards(() => IN_PROGRESS)

    expect(requireFinishedMatch()).toEqual({ name: 'match' })
  })

  it('keeps the coach on the match between sets', () => {
    const { requireFinishedMatch } = createGuards(() => BETWEEN_SETS)

    expect(requireFinishedMatch()).toEqual({ name: 'match' })
  })

  it('allows the summary of a finished match', () => {
    const { requireFinishedMatch } = createGuards(() => FINISHED)

    expect(requireFinishedMatch()).toBe(true)
  })
})
