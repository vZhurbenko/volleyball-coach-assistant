import { describe, it, expect } from 'vitest'

import { defaultLineup } from '../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../domain/match.js'
import { MOCK_ROSTER } from '../domain/players.js'
import { TEAMS } from '../domain/score.js'
import { STORAGE_KEY, clearMatch, loadMatch, saveMatch } from '../storage.js'

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage(initial = {}) {
  const items = new Map(Object.entries(initial))
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

/** Хранилище, которое отказывает: приватный режим или переполнение. */
function brokenStorage() {
  return {
    getItem: () => {
      throw new Error('storage is not available')
    },
    setItem: () => {
      throw new Error('storage is not available')
    },
    removeItem: () => {
      throw new Error('storage is not available')
    },
  }
}

const SIX = defaultLineup(MOCK_ROSTER)

const MATCH = {
  events: [{ type: EVENT_TYPES.SET_START, lineup: SIX, serving: TEAMS.US }],
  settings: { opponent: 'Динамо', lineup: SIX, serving: TEAMS.US },
}

describe('saveMatch', () => {
  it('saves the journal and the settings', () => {
    const storage = fakeStorage()
    saveMatch(MATCH, storage)

    expect(loadMatch(storage)).toEqual(MATCH)
  })

  it('overwrites the previous match', () => {
    const storage = fakeStorage()
    saveMatch(MATCH, storage)
    saveMatch({ events: [], settings: { opponent: 'Локомотив' } }, storage)

    expect(loadMatch(storage).settings.opponent).toBe('Локомотив')
  })

  it('writes under a versioned key', () => {
    const storage = fakeStorage()
    saveMatch(MATCH, storage)

    expect(storage.getItem(STORAGE_KEY)).toBeTruthy()
  })

  it('reports a storage that refuses to save', () => {
    expect(saveMatch(MATCH, brokenStorage())).toBe(false)
  })

  it('reports a successful save', () => {
    expect(saveMatch(MATCH, fakeStorage())).toBe(true)
  })
})

describe('loadMatch', () => {
  it('has nothing to load before the first save', () => {
    expect(loadMatch(fakeStorage())).toBeNull()
  })

  it('starts clean when the record is broken', () => {
    expect(loadMatch(fakeStorage({ [STORAGE_KEY]: '{не json' }))).toBeNull()
  })

  it('starts clean when the record is not an object', () => {
    expect(loadMatch(fakeStorage({ [STORAGE_KEY]: '"строка"' }))).toBeNull()
  })

  it('starts clean when the journal is missing', () => {
    expect(loadMatch(fakeStorage({ [STORAGE_KEY]: '{"settings":{}}' }))).toBeNull()
  })

  it('ignores the record of another version', () => {
    const old = fakeStorage({ 'volleyball-coach-assistant:match:v0': JSON.stringify(MATCH) })
    expect(loadMatch(old)).toBeNull()
  })

  it('starts clean when the storage refuses to read', () => {
    expect(loadMatch(brokenStorage())).toBeNull()
  })

  it('fills in missing settings', () => {
    const storage = fakeStorage({ [STORAGE_KEY]: '{"events":[]}' })
    expect(loadMatch(storage).settings).toEqual({})
  })
})

describe('clearMatch', () => {
  it('removes the saved match', () => {
    const storage = fakeStorage()
    saveMatch(MATCH, storage)

    clearMatch(storage)

    expect(loadMatch(storage)).toBeNull()
  })

  it('survives a storage that refuses to clear', () => {
    expect(() => clearMatch(brokenStorage())).not.toThrow()
  })
})

describe('restoring a match', () => {
  it('builds the state back from the saved journal', () => {
    const storage = fakeStorage()
    const events = [
      { type: EVENT_TYPES.SET_START, lineup: SIX, serving: TEAMS.THEM },
      { type: EVENT_TYPES.POINT, team: TEAMS.THEM },
      { type: EVENT_TYPES.POINT, team: TEAMS.US },
    ]
    saveMatch({ events, settings: { opponent: 'Динамо' } }, storage)

    const state = matchState(loadMatch(storage).events)

    expect(state.setNumber).toBe(1)
    expect(state.rotations).toBe(1)
    expect(state.score.serving).toBe(TEAMS.US)
  })

  it('has no match to restore after a reset', () => {
    const storage = fakeStorage()
    saveMatch(MATCH, storage)
    clearMatch(storage)

    expect(matchState(loadMatch(storage)?.events ?? [])).toBeNull()
  })
})
