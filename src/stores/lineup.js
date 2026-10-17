import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { cloneLineup, defaultLineup, validateLineup } from '../domain/lineup.js'
import { TEAM_ROSTER, findPlayer } from '../domain/players.js'
import {
  applyRoleChange,
  createPlayer,
  isRoster,
  reconcileLineup,
  removePlayerFromLineup,
  sortRoster,
  validatePlayer,
} from '../domain/roster.js'
import { loadRosterSettings, saveRosterSettings } from '../storage.js'

/** Игрок так, как он лежит в хранилище: без `startingZone` и лишних полей. */
function toStoredPlayer(player) {
  return createPlayer(player, player.id)
}

function withZone(lineup, zone, { playerId, role }) {
  return {
    ...lineup,
    zones: { ...lineup.zones, [zone]: { playerId, role } },
  }
}

function newPlayerId() {
  if (typeof globalThis.crypto?.randomUUID === 'function') return globalThis.crypto.randomUUID()

  return `player-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
}

/**
 * Стартовая расстановка и состав команды.
 *
 * В памяти живут две шестёрки: рабочая (`lineup`) — её правит тренер на экране
 * расстановки, и сохранённая (`defaultSix`) — шаблон из настроек состава. Правки
 * на `/` не переписывают шаблон, иначе любая случайная перестановка перед матчем
 * стала бы новой «стартовой шестёркой».
 *
 * Рабочая шестёрка живёт только в памяти. Состав и шаблон пишутся в хранилище
 * сразу после каждого изменения; `load()` идемпотентен и засевает встроенный
 * состав, если хранилище пустое.
 */
export const useLineupStore = defineStore('lineup', () => {
  const roster = ref(TEAM_ROSTER.map(toStoredPlayer))
  const lineup = ref(defaultLineup(TEAM_ROSTER))
  const defaultSix = ref(cloneLineup(lineup.value))
  const validation = computed(() => validateLineup(lineup.value, roster.value))

  let storage
  let loaded = false

  /**
   * Читает состав и шаблон шестёрки. Повторные вызовы только запоминают
   * хранилище: экраны монтируются заново, но правки в памяти не теряются.
   *
   * @param {Storage} [targetStorage] — по умолчанию localStorage
   */
  function load(targetStorage) {
    storage = targetStorage
    if (loaded) return
    loaded = true

    const saved = loadRosterSettings(storage)
    if (!saved) {
      roster.value = sortRoster(TEAM_ROSTER.map(toStoredPlayer))
      defaultSix.value = defaultLineup(TEAM_ROSTER)
      lineup.value = cloneLineup(defaultSix.value)
      persistSettings()
      return
    }

    roster.value = sortRoster(saved.players.map((player) => ({ ...player })))
    defaultSix.value = reconcileLineup(saved.defaultLineup, roster.value)
    lineup.value = cloneLineup(defaultSix.value)

    // Битая или отсутствующая шестёрка — повод записать исправленную версию.
    if (!saved.defaultLineup) persistSettings()
  }

  /**
   * Тестовый шов: подменяет состав и собирает из него дефолтную шестёрку.
   * Помечает store загруженным, чтобы последующий `load()` не перетёр состав.
   *
   * @param {import('../domain/players.js').Player[]} teamRoster
   */
  function init(teamRoster) {
    loaded = true
    roster.value = sortRoster(teamRoster.map(toStoredPlayer))
    defaultSix.value = defaultLineup(teamRoster)
    lineup.value = cloneLineup(defaultSix.value)
  }

  /**
   * @param {number} zone
   * @param {{ playerId: string, role: string }} assignment
   */
  function assign(zone, assignment) {
    lineup.value = withZone(lineup.value, zone, assignment)
  }

  /**
   * Назначение в настройках состава: меняет и рабочую шестёрку, и шаблон.
   *
   * @param {number} zone
   * @param {{ playerId: string, role: string }} assignment
   */
  function assignDefault(zone, assignment) {
    lineup.value = withZone(lineup.value, zone, assignment)
    defaultSix.value = withZone(defaultSix.value, zone, assignment)
    persistSettings()
  }

  /** @param {string | null} liberoId */
  function setLibero(liberoId) {
    lineup.value = { ...lineup.value, liberoId }
  }

  /**
   * Ставит готовую шестёрку — например, из прошлой партии перед следующей.
   * Шаблон настроек при этом не меняется.
   *
   * @param {import('../domain/lineup.js').Lineup} nextLineup
   */
  function setLineup(nextLineup) {
    lineup.value = cloneLineup(nextLineup)
  }

  /** Возвращает рабочую шестёрку к сохранённому шаблону. */
  function reset() {
    lineup.value = cloneLineup(defaultSix.value)
  }

  /**
   * @param {{ firstName: string, lastName: string, number: unknown, role: string }} input
   * @param {string} [id]
   * @returns {{ ok: true, player: object } | { ok: false, violations: object[] }}
   */
  function addPlayer(input, id = newPlayerId()) {
    if (findPlayer(roster.value, id)) {
      return {
        ok: false,
        violations: [{ code: 'PLAYER_EXISTS', field: 'id', message: 'Игрок уже есть в составе' }],
      }
    }

    const result = validatePlayer(input)
    if (!result.valid) return { ok: false, violations: result.violations }

    const player = createPlayer(input, id)
    roster.value = sortRoster([...roster.value, player])
    persistSettings()

    return { ok: true, player }
  }

  /**
   * @param {string} playerId
   * @param {{ firstName: string, lastName: string, number: unknown, role: string }} input
   * @returns {{ ok: true, player: object } | { ok: false, violations: object[] }}
   */
  function updatePlayer(playerId, input) {
    const current = findPlayer(roster.value, playerId)
    if (!current) {
      return {
        ok: false,
        violations: [{ code: 'PLAYER_NOT_FOUND', field: 'id', message: 'Игрок не найден' }],
      }
    }

    const result = validatePlayer(input)
    if (!result.valid) return { ok: false, violations: result.violations }

    const player = createPlayer(input, playerId)
    roster.value = sortRoster(
      roster.value.map((item) => (item.id === playerId ? player : item)),
    )

    if (player.role !== current.role) {
      lineup.value = applyRoleChange(lineup.value, playerId, current.role, player.role)
      defaultSix.value = applyRoleChange(defaultSix.value, playerId, current.role, player.role)
    }

    persistSettings()

    return { ok: true, player }
  }

  /**
   * Убирает игрока из состава и из обеих шестёрок.
   *
   * @param {string} playerId
   * @returns {boolean}
   */
  function removePlayer(playerId) {
    if (!findPlayer(roster.value, playerId)) return false

    roster.value = roster.value.filter((player) => player.id !== playerId)
    lineup.value = removePlayerFromLineup(lineup.value, playerId)
    defaultSix.value = removePlayerFromLineup(defaultSix.value, playerId)
    persistSettings()

    return true
  }

  function persistSettings() {
    saveRosterSettings({ players: roster.value, defaultLineup: defaultSix.value }, storage)
  }

  /** Отдаёт состав и шаблон для экспорта в JSON. Копии не связаны со store. */
  function exportSettings() {
    return {
      version: 1,
      players: roster.value.map((player) => ({ ...player })),
      defaultLineup: cloneLineup(defaultSix.value),
    }
  }

  /**
   * Полностью заменяет состав и шаблон шестёрки импортированными данными.
   * Невалидный JSON или состав ничего не меняет и не пишет.
   *
   * @param {{ version?: number, players?: unknown, defaultLineup?: object | null }} settings
   * @returns {{ ok: true } | { ok: false, violations: object[] }}
   */
  function replaceSettings(settings) {
    if (settings?.version != null && settings.version !== 1) {
      return {
        ok: false,
        violations: [
          {
            code: 'UNSUPPORTED_VERSION',
            field: 'version',
            message: 'Неподдерживаемая версия JSON',
          },
        ],
      }
    }

    if (!isRoster(settings?.players)) {
      return {
        ok: false,
        violations: [
          {
            code: 'INVALID_ROSTER',
            field: 'players',
            message: 'JSON не содержит корректный состав',
          },
        ],
      }
    }

    roster.value = sortRoster(settings.players.map((player) => createPlayer(player, player.id)))
    defaultSix.value = reconcileLineup(settings.defaultLineup ?? null, roster.value)
    lineup.value = cloneLineup(defaultSix.value)
    persistSettings()

    return { ok: true }
  }

  return {
    roster,
    lineup,
    validation,
    load,
    init,
    assign,
    assignDefault,
    setLibero,
    setLineup,
    reset,
    addPlayer,
    updatePlayer,
    removePlayer,
    exportSettings,
    replaceSettings,
  }
})
