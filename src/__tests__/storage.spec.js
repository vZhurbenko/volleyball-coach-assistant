import { describe, it, expect } from 'vitest'

import { defaultLineup, emptyLineup } from '../domain/lineup.js'
import { EVENT_TYPES, matchState } from '../domain/match.js'
import { TEAM_ROSTER } from '../domain/players.js'
import { TEAMS } from '../domain/score.js'
import {
  ROSTER_STORAGE_KEY,
  STORAGE_KEY,
  clearMatch,
  loadMatch,
  loadRosterSettings,
  saveMatch,
  saveRosterSettings,
} from '../storage.js'

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

const SIX = defaultLineup(TEAM_ROSTER)

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

const ROSTER_SETTINGS = { players: TEAM_ROSTER, defaultLineup: SIX }

describe('saveRosterSettings', () => {
  it('saves and restores the roster and the default six', () => {
    const storage = fakeStorage()
    saveRosterSettings(ROSTER_SETTINGS, storage)

    expect(loadRosterSettings(storage)).toEqual(ROSTER_SETTINGS)
  })

  it('overwrites the previous roster', () => {
    const storage = fakeStorage()
    saveRosterSettings(ROSTER_SETTINGS, storage)
    saveRosterSettings({ players: [], defaultLineup: emptyLineup() }, storage)

    expect(loadRosterSettings(storage).players).toEqual([])
  })

  it('writes under a versioned key', () => {
    const storage = fakeStorage()
    saveRosterSettings(ROSTER_SETTINGS, storage)

    expect(ROSTER_STORAGE_KEY).toBe('volleyball-coach-assistant:roster:v1')
    expect(storage.getItem(ROSTER_STORAGE_KEY)).not.toBeNull()
  })

  it('refuses to save into a broken storage', () => {
    expect(saveRosterSettings(ROSTER_SETTINGS, brokenStorage())).toBe(false)
  })
})

describe('loadRosterSettings', () => {
  it('accepts an empty roster', () => {
    const storage = fakeStorage({
      [ROSTER_STORAGE_KEY]: JSON.stringify({ players: [], defaultLineup: emptyLineup() }),
    })

    expect(loadRosterSettings(storage)).toEqual({ players: [], defaultLineup: emptyLineup() })
  })

  it('returns a null default six when that part is missing', () => {
    const storage = fakeStorage({ [ROSTER_STORAGE_KEY]: JSON.stringify({ players: TEAM_ROSTER }) })

    expect(loadRosterSettings(storage)).toEqual({ players: TEAM_ROSTER, defaultLineup: null })
  })

  it.each([
    ['broken JSON', '{не json'],
    ['a non-object', '"строка"'],
    ['a missing roster', '{}'],
    ['a malformed player', '{"players":[{"id":"x"}]}'],
    [
      'duplicate ids',
      '{"players":[{"id":"same","firstName":"А","lastName":"Б","number":1,"role":"setter"},{"id":"same","firstName":"В","lastName":"Г","number":2,"role":"setter"}]}',
    ],
  ])('starts clean on %s', (_name, raw) => {
    const storage = fakeStorage({ [ROSTER_STORAGE_KEY]: raw })

    expect(loadRosterSettings(storage)).toBeNull()
  })

  it('ignores the previous version of the record', () => {
    const storage = fakeStorage({
      'volleyball-coach-assistant:roster:v0': JSON.stringify(ROSTER_SETTINGS),
    })

    expect(loadRosterSettings(storage)).toBeNull()
  })

  it('starts clean when the storage refuses to read', () => {
    expect(loadRosterSettings(brokenStorage())).toBeNull()
  })
})
