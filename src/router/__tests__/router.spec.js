import { beforeEach, describe, expect, it } from 'vitest'
import { createMemoryHistory } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/players.js'
import { TEAMS } from '../../domain/score.js'
import { clearMatch, saveMatch } from '../../storage.js'
import { createAppRouter } from '../index.js'

const LINEUP = defaultLineup(TEAM_ROSTER)

const SET_START = { type: EVENT_TYPES.SET_START, lineup: LINEUP, serving: TEAMS.US }
const POINT_US = { type: EVENT_TYPES.POINT, team: TEAMS.US }

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

/** Журнал матча, в котором мы взяли три партии подряд. */
function finishedMatchEvents() {
  const set = [SET_START, ...Array.from({ length: 25 }, () => POINT_US)]
  return [...set, ...set, ...set]
}

let storage

function saveSavedMatch(events) {
  saveMatch({ events, settings: {} }, storage)
}

async function startAt(path) {
  const router = createAppRouter({ history: createMemoryHistory(), storage })
  await router.push(path)
  await router.isReady()
  return router
}

beforeEach(() => {
  storage = fakeStorage()
  clearMatch(storage)
})

describe('routes', () => {
  it('maps the scenario screens', () => {
    const router = createAppRouter({ history: createMemoryHistory() })

    expect(router.resolve('/').name).toBe('lineup')
    expect(router.resolve('/setup').name).toBe('setup')
    expect(router.resolve('/match').name).toBe('match')
    expect(router.resolve('/summary').name).toBe('summary')
  })
})

describe('reload mid-match', () => {
  it('returns to the match screen', async () => {
    saveSavedMatch([SET_START, POINT_US])

    const router = await startAt('/match')

    expect(router.currentRoute.value.name).toBe('match')
  })

  it('opens the match screen from the root', async () => {
    saveSavedMatch([SET_START, POINT_US])

    const router = await startAt('/')

    expect(router.currentRoute.value.name).toBe('match')
  })
})

describe('guards in the real router', () => {
  it('does not enter the match screen without a match', async () => {
    const router = await startAt('/match')

    expect(router.currentRoute.value.name).toBe('lineup')
  })

  it('does not enter the summary before the match is over', async () => {
    saveSavedMatch([SET_START, POINT_US])

    const router = await startAt('/summary')

    expect(router.currentRoute.value.name).toBe('match')
  })

  it('returns to the summary of a finished match', async () => {
    saveSavedMatch(finishedMatchEvents())

    const router = await startAt('/')

    expect(router.currentRoute.value.name).toBe('summary')
  })

  it('opens the setup screen of a new match', async () => {
    const router = await startAt('/setup')

    expect(router.currentRoute.value.name).toBe('setup')
  })
})
