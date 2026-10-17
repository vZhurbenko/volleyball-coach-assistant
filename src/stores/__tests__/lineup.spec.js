import { beforeEach, describe, expect, it } from 'vitest'

import { createPinia, setActivePinia } from 'pinia'

import { ROLES } from '../../domain/constants.js'
import { defaultLineup, emptyLineup } from '../../domain/lineup.js'
import { TEAM_ROSTER } from '../../domain/__tests__/fixtures/team-roster.js'
import { loadRosterSettings, saveRosterSettings } from '../../storage.js'
import { useLineupStore } from '../lineup.js'

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

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

/** Игроки так, как они лежат в хранилище: без стартовой зоны, по номерам. */
function storedRoster(roster = TEAM_ROSTER) {
  return roster
    .map((player) => ({
      id: player.id,
      firstName: player.firstName,
      lastName: player.lastName,
      number: player.number,
      role: player.role,
    }))
    .sort(
      (first, second) =>
        first.number - second.number ||
        first.lastName.localeCompare(second.lastName, 'ru') ||
        first.firstName.localeCompare(second.firstName, 'ru'),
    )
}

const DEFAULT_SIX = defaultLineup(TEAM_ROSTER)

/** Хранилище с уже сохранённым тестовым составом и шестёркой. */
function seededStorage() {
  const storage = fakeStorage()
  saveRosterSettings({ players: storedRoster(), defaultLineup: DEFAULT_SIX }, storage)
  return storage
}

const LIBERO = {
  id: 'lib',
  firstName: 'Лев',
  lastName: 'Либеро',
  number: 99,
  role: ROLES.LIBERO,
}

const ROSTER_WITH_LIBERO = [...storedRoster(), LIBERO]

const NEW_PLAYER = {
  firstName: 'Иван',
  lastName: 'Петров',
  number: 13,
  role: ROLES.OUTSIDE_HITTER,
}

beforeEach(() => {
  setActivePinia(createPinia())
})

describe('load', () => {
  it('starts with an empty roster and an empty six in empty storage', () => {
    const storage = fakeStorage()
    const store = useLineupStore()

    store.load(storage)

    expect(store.roster).toEqual([])
    expect(store.lineup).toEqual(emptyLineup())
    expect(loadRosterSettings(storage)).toEqual({
      players: [],
      defaultLineup: emptyLineup(),
      teamName: '',
    })
  })

  it('restores the saved roster and reconciles the default six', () => {
    const storage = fakeStorage()
    const brokenSix = {
      zones: { ...DEFAULT_SIX.zones, 2: { playerId: 'ghost', role: ROLES.OUTSIDE_HITTER } },
      liberoId: null,
    }
    saveRosterSettings({ players: storedRoster(), defaultLineup: brokenSix }, storage)

    const store = useLineupStore()
    store.load(storage)

    expect(store.roster).toEqual(storedRoster())
    expect(store.lineup.zones[2]).toBeNull()
    expect(store.lineup.zones[1]).toEqual(DEFAULT_SIX.zones[1])
  })

  it('repairs a missing default six and writes the repaired record back', () => {
    const storage = fakeStorage()
    saveRosterSettings({ players: storedRoster() }, storage)

    const store = useLineupStore()
    store.load(storage)

    expect(store.lineup.zones[1]).toBeNull()
    expect(loadRosterSettings(storage).defaultLineup).toEqual({
      zones: {
        1: null,
        2: null,
        3: null,
        4: null,
        5: null,
        6: null,
      },
      liberoId: null,
    })
  })

  it('loads only once, but remembers a new storage for later writes', () => {
    const first = fakeStorage()
    const second = fakeStorage()
    const store = useLineupStore()

    store.load(first)
    store.assign(1, { playerId: 'fatkulin', role: ROLES.SETTER })
    store.load(second)
    store.addPlayer(NEW_PLAYER, 'petrov')

    expect(store.lineup.zones[1].playerId).toBe('fatkulin')
    expect(loadRosterSettings(second).players).toContainEqual(
      expect.objectContaining({ id: 'petrov' }),
    )
    expect(loadRosterSettings(first).players).not.toContainEqual(
      expect.objectContaining({ id: 'petrov' }),
    )
  })

  it('does not overwrite a roster injected by init', () => {
    const storage = fakeStorage()
    const store = useLineupStore()

    store.init([...TEAM_ROSTER, LIBERO])
    store.load(storage)

    expect(store.roster).toEqual([...storedRoster(), LIBERO])

    store.addPlayer(NEW_PLAYER, 'petrov')

    expect(store.roster).toContainEqual(expect.objectContaining({ id: 'petrov' }))
    expect(loadRosterSettings(storage).players).toContainEqual(
      expect.objectContaining({ id: 'petrov' }),
    )
  })

  it('keeps working when the storage is unavailable', () => {
    const store = useLineupStore()

    store.load(brokenStorage())
    store.addPlayer(NEW_PLAYER, 'petrov')

    expect(store.roster).toContainEqual(expect.objectContaining({ id: 'petrov' }))
  })
})

describe('working lineup and default six', () => {
  it('does not persist edits made on the lineup screen', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.assign(1, { playerId: 'fatkulin', role: ROLES.SETTER })
    store.setLibero(null)
    store.setLineup({ ...DEFAULT_SIX, zones: { ...DEFAULT_SIX.zones, 1: null } })

    expect(store.lineup.zones[1]).toBeNull()
    expect(loadRosterSettings(storage).defaultLineup).toEqual(DEFAULT_SIX)
  })

  it('updates both lineups and persists on assignDefault', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.assignDefault(1, { playerId: 'fatkulin', role: ROLES.SETTER })

    expect(store.lineup.zones[1]).toEqual({ playerId: 'fatkulin', role: ROLES.SETTER })
    expect(loadRosterSettings(storage).defaultLineup.zones[1]).toEqual({
      playerId: 'fatkulin',
      role: ROLES.SETTER,
    })
  })

  it('restores the default six on reset', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.assign(1, { playerId: 'fatkulin', role: ROLES.SETTER })
    store.reset()

    expect(store.lineup).toEqual(DEFAULT_SIX)

    store.assignDefault(1, { playerId: 'fatkulin', role: ROLES.SETTER })
    store.assign(1, { playerId: 'titov', role: ROLES.OPPOSITE })
    store.reset()

    expect(store.lineup.zones[1].playerId).toBe('fatkulin')
  })
})

describe('addPlayer', () => {
  it('keeps the roster sorted by number', () => {
    const store = useLineupStore()
    store.load(seededStorage())

    const numbers = store.roster.map((player) => player.number)
    expect(numbers).toEqual([...numbers].sort((first, second) => first - second))

    store.updatePlayer('titov', {
      firstName: 'Александр',
      lastName: 'Титов',
      number: 99,
      role: ROLES.OPPOSITE,
    })
    store.addPlayer({ ...NEW_PLAYER, number: 1 }, 'first')

    expect(store.roster[0]).toEqual(expect.objectContaining({ id: 'first', number: 1 }))
    expect(store.roster.at(-1)).toEqual(expect.objectContaining({ id: 'titov', number: 99 }))
  })

  it('adds a normalized player and persists it', () => {
    const storage = fakeStorage()
    const store = useLineupStore()
    store.load(storage)

    const result = store.addPlayer({ ...NEW_PLAYER, firstName: ' Иван ' }, 'petrov')

    expect(result).toEqual({
      ok: true,
      player: {
        id: 'petrov',
        firstName: 'Иван',
        lastName: 'Петров',
        number: 13,
        role: ROLES.OUTSIDE_HITTER,
      },
    })
    expect(store.roster).toContainEqual(result.player)
    expect(loadRosterSettings(storage).players).toContainEqual(result.player)
  })

  it('rejects invalid input without changing anything', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)
    const before = loadRosterSettings(storage)

    const result = store.addPlayer({ firstName: '', lastName: '', number: 0, role: 'coach' }, 'bad')

    expect(result.ok).toBe(false)
    expect(result.violations.map((violation) => violation.code)).toEqual([
      'FIRST_NAME_REQUIRED',
      'LAST_NAME_REQUIRED',
      'INVALID_NUMBER',
      'INVALID_ROLE',
    ])
    expect(store.roster).toEqual(storedRoster())
    expect(loadRosterSettings(storage)).toEqual(before)
  })

  it('rejects a duplicate id', () => {
    const store = useLineupStore()
    store.load(seededStorage())

    const result = store.addPlayer(NEW_PLAYER, 'titov')

    expect(result.ok).toBe(false)
    expect(result.violations[0].code).toBe('PLAYER_EXISTS')
  })
})

describe('updatePlayer', () => {
  it('changes the name and the number without touching the lineup', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    const result = store.updatePlayer('titov', {
      firstName: 'Александр',
      lastName: 'Титов-младший',
      number: 22,
      role: ROLES.OPPOSITE,
    })

    expect(result.ok).toBe(true)
    expect(store.roster).toContainEqual(expect.objectContaining({ id: 'titov', number: 22 }))
    expect(store.lineup.zones[1]).toEqual(DEFAULT_SIX.zones[1])
    expect(loadRosterSettings(storage).players).toContainEqual(
      expect.objectContaining({ id: 'titov', lastName: 'Титов-младший' }),
    )
  })

  it('syncs the role snapshots in both lineups', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.updatePlayer('titov', {
      firstName: 'Александр',
      lastName: 'Титов',
      number: 2,
      role: ROLES.SETTER,
    })

    expect(store.lineup.zones[1].role).toBe(ROLES.SETTER)
    expect(loadRosterSettings(storage).defaultLineup.zones[1].role).toBe(ROLES.SETTER)
  })

  it('preserves a per-zone role override', () => {
    const store = useLineupStore()
    store.load(seededStorage())
    store.assignDefault(1, { playerId: 'titov', role: ROLES.SETTER })

    store.updatePlayer('titov', {
      firstName: 'Александр',
      lastName: 'Титов',
      number: 2,
      role: ROLES.OUTSIDE_HITTER,
    })

    expect(store.lineup.zones[1].role).toBe(ROLES.SETTER)
  })

  it('removes the player from the zones when they become a libero', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.updatePlayer('titov', {
      firstName: 'Александр',
      lastName: 'Титов',
      number: 2,
      role: ROLES.LIBERO,
    })

    expect(store.lineup.zones[1]).toBeNull()
    expect(loadRosterSettings(storage).defaultLineup.zones[1]).toBeNull()
  })

  it('clears the libero slot when the libero becomes a court player', () => {
    const storage = fakeStorage()
    saveRosterSettings(
      {
        players: ROSTER_WITH_LIBERO,
        defaultLineup: { ...DEFAULT_SIX, liberoId: 'lib' },
      },
      storage,
    )
    const store = useLineupStore()
    store.load(storage)

    store.updatePlayer('lib', { ...LIBERO, role: ROLES.OUTSIDE_HITTER })

    expect(store.lineup.liberoId).toBeNull()
    expect(loadRosterSettings(storage).defaultLineup.liberoId).toBeNull()
  })

  it('rejects an unknown player and invalid input', () => {
    const store = useLineupStore()
    store.load(seededStorage())

    expect(store.updatePlayer('ghost', NEW_PLAYER).violations[0].code).toBe('PLAYER_NOT_FOUND')
    expect(store.updatePlayer('titov', { ...NEW_PLAYER, role: 'coach' }).ok).toBe(false)
    expect(store.roster).toContainEqual(expect.objectContaining({ id: 'titov', role: ROLES.OPPOSITE }))
  })
})

describe('removePlayer', () => {
  it('removes the player from the roster, both lineups and the storage', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    expect(store.removePlayer('titov')).toBe(true)

    expect(store.roster.some((player) => player.id === 'titov')).toBe(false)
    expect(store.lineup.zones[1]).toBeNull()
    expect(loadRosterSettings(storage).defaultLineup.zones[1]).toBeNull()
    expect(loadRosterSettings(storage).players.some((player) => player.id === 'titov')).toBe(false)
  })

  it('ignores an unknown player', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)
    const before = loadRosterSettings(storage)

    expect(store.removePlayer('ghost')).toBe(false)
    expect(loadRosterSettings(storage)).toEqual(before)
  })

  it('allows removing the last player', () => {
    const storage = fakeStorage()
    saveRosterSettings(
      {
        players: [storedRoster().find((player) => player.id === 'titov')],
        defaultLineup: { ...DEFAULT_SIX, zones: Object.fromEntries([1, 2, 3, 4, 5, 6].map((zone) => [zone, null])) },
      },
      storage,
    )
    const store = useLineupStore()
    store.load(storage)

    store.removePlayer('titov')

    expect(store.roster).toEqual([])
  })
})

describe('immutability', () => {
  it('never mutates the built-in roster', () => {
    const snapshot = JSON.parse(JSON.stringify(TEAM_ROSTER))
    const store = useLineupStore()
    store.load(seededStorage())

    store.updatePlayer('titov', { ...NEW_PLAYER, lastName: 'Титов' })
    store.addPlayer(NEW_PLAYER, 'petrov')
    store.removePlayer('gromov')

    expect(TEAM_ROSTER).toEqual(snapshot)
  })
})

describe('exportSettings', () => {
  it('returns a detached copy of the roster and the default six', () => {
    const store = useLineupStore()
    store.load(seededStorage())
    store.assignDefault(1, { playerId: 'fatkulin', role: ROLES.SETTER })

    const exported = store.exportSettings()

    expect(exported.version).toBe(1)
    expect(exported.teamName).toBe('')
    expect(exported.players).toEqual(store.roster)
    expect(exported.defaultLineup.zones[1].playerId).toBe('fatkulin')

    exported.players[0].lastName = 'Изменено'
    expect(store.roster[0].lastName).not.toBe('Изменено')
  })
})

describe('default team name', () => {
  it('stores and persists the default team name', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)

    store.setDefaultTeamName('  Наши  ')

    expect(store.defaultTeamName).toBe('Наши')
    expect(loadRosterSettings(storage).teamName).toBe('Наши')
  })
})

describe('replaceSettings', () => {
  const IMPORTED_PLAYERS = [
    { id: 'imported', firstName: 'Новый', lastName: 'Игрок', number: 77, role: ROLES.SETTER },
  ]
  const IMPORTED_SIX = {
    zones: {
      1: { playerId: 'imported', role: ROLES.SETTER },
      2: null,
      3: null,
      4: null,
      5: null,
      6: null,
    },
    liberoId: null,
  }

  it('replaces the roster, the default six and the working lineup', () => {
    const storage = fakeStorage()
    const store = useLineupStore()
    store.load(storage)

    const result = store.replaceSettings({
      teamName: 'Наши',
      players: IMPORTED_PLAYERS,
      defaultLineup: IMPORTED_SIX,
    })

    expect(result).toEqual({ ok: true })
    expect(store.defaultTeamName).toBe('Наши')
    expect(store.roster).toEqual(IMPORTED_PLAYERS)
    expect(store.lineup).toEqual(IMPORTED_SIX)
    expect(loadRosterSettings(storage)).toEqual({
      players: IMPORTED_PLAYERS,
      defaultLineup: IMPORTED_SIX,
      teamName: 'Наши',
    })
  })

  it('rejects invalid input without changing anything', () => {
    const storage = seededStorage()
    const store = useLineupStore()
    store.load(storage)
    const before = loadRosterSettings(storage)

    const result = store.replaceSettings({ players: [{ id: 'broken' }] })

    expect(result.ok).toBe(false)
    expect(store.roster).toEqual(storedRoster())
    expect(loadRosterSettings(storage)).toEqual(before)
  })

  it('rejects an unknown file version', () => {
    const store = useLineupStore()
    store.load(seededStorage())

    const result = store.replaceSettings({ version: 99, players: IMPORTED_PLAYERS })

    expect(result.ok).toBe(false)
    expect(result.violations[0].code).toBe('UNSUPPORTED_VERSION')
  })
})
