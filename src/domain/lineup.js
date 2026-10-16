import { LINEUP_ROLE_LIMITS, ROLES, ZONES } from './constants.js'
import { findPlayer } from './players.js'

/**
 * @typedef {object} ZoneAssignment
 * @property {string} playerId
 * @property {string} role — роль на момент назначения, её можно переопределить
 */

/**
 * @typedef {object} Lineup
 * @property {Record<number, ZoneAssignment | null>} zones — шестёрка по зонам 1–6
 * @property {string | null} liberoId
 */

/**
 * @typedef {object} Violation
 * @property {string} code — для логики интерфейса
 * @property {string} message — готовый текст для показа тренеру
 * @property {number} [zone]
 */

/**
 * @typedef {object} LineupValidation
 * @property {boolean} valid
 * @property {Violation[]} violations
 */

/** Пустая расстановка: все зоны свободны, либеро не назначен. */
export function emptyLineup() {
  return { zones: Object.fromEntries(ZONES.map((zone) => [zone, null])), liberoId: null }
}

/**
 * Дефолтная стартовая шестёрка — база 5-1: связка в зоне 1 и диагональный
 * в зоне 4, доигровщики в зонах 2 и 5, ЦБ в зонах 3 и 6.
 * Игроки берутся из состава по порядку — первые подходящие по роли.
 *
 * @param {import('./players.js').Player[]} roster
 * @returns {Lineup}
 */
export function defaultLineup(roster) {
  const byRole = (role) => roster.filter((player) => player.role === role)

  const setters = byRole(ROLES.SETTER)
  const opposites = byRole(ROLES.OPPOSITE)
  const outsideHitters = byRole(ROLES.OUTSIDE_HITTER)
  const middleBlockers = byRole(ROLES.MIDDLE_BLOCKER)

  return {
    zones: {
      1: assignment(setters[0]),
      2: assignment(outsideHitters[0]),
      3: assignment(middleBlockers[0]),
      4: assignment(opposites[0]),
      5: assignment(outsideHitters[1]),
      6: assignment(middleBlockers[1]),
    },
    liberoId: null,
  }
}

/**
 * Проверяет стартовую расстановку по правилам из docs/requirements.md.
 *
 * @param {Lineup} lineup
 * @param {import('./players.js').Player[]} roster
 * @returns {LineupValidation}
 */
export function validateLineup(lineup, roster) {
  const filled = filledZones(lineup)
  const violations = [
    ...emptyZoneViolations(lineup),
    ...duplicatePlayerViolations(filled, roster),
    ...roleLimitViolations(filled),
    ...liberoViolations(lineup, roster),
  ]

  return { valid: violations.length === 0, violations }
}

/** @param {import('./players.js').Player | undefined} player */
function assignment(player) {
  return player ? { playerId: player.id, role: player.role } : null
}

/** Заполненные зоны вместе с их номерами. */
function filledZones(lineup) {
  return ZONES.filter((zone) => lineup.zones[zone]).map((zone) => ({
    zone,
    ...lineup.zones[zone],
  }))
}

function emptyZoneViolations(lineup) {
  return ZONES.filter((zone) => !lineup.zones[zone]).map((zone) => ({
    code: 'EMPTY_ZONE',
    zone,
    message: `Зона ${zone} не заполнена`,
  }))
}

function duplicatePlayerViolations(filled, roster) {
  const zonesByPlayer = new Map()
  for (const { zone, playerId } of filled) {
    zonesByPlayer.set(playerId, [...(zonesByPlayer.get(playerId) ?? []), zone])
  }

  return [...zonesByPlayer]
    .filter(([, zones]) => zones.length > 1)
    .map(([playerId, zones]) => ({
      code: 'DUPLICATE_PLAYER',
      message: `Игрок ${fullName(roster, playerId)} назначен в несколько зон: ${zones.join(', ')}`,
    }))
}

const ROLE_LIMIT_VIOLATIONS = {
  [ROLES.MIDDLE_BLOCKER]: {
    code: 'TOO_MANY_MIDDLE_BLOCKERS',
    message: 'В шестёрке больше двух центральных блокирующих',
  },
  [ROLES.OUTSIDE_HITTER]: {
    code: 'TOO_MANY_OUTSIDE_HITTERS',
    message: 'В шестёрке больше двух доигровщиков',
  },
  [ROLES.OPPOSITE]: {
    code: 'TOO_MANY_OPPOSITES',
    message: 'В шестёрке больше одного диагонального',
  },
}

function roleLimitViolations(filled) {
  const count = (role) => filled.filter(({ role: assigned }) => assigned === role).length

  const violations = Object.entries(ROLE_LIMIT_VIOLATIONS)
    .filter(([role]) => count(role) > LINEUP_ROLE_LIMITS[role].max)
    .map(([, violation]) => ({ ...violation }))

  const hasOpposite = count(ROLES.OPPOSITE) > 0
  const setterLimit = LINEUP_ROLE_LIMITS[ROLES.SETTER]
  const maxSetters = hasOpposite ? setterLimit.maxWithOpposite : setterLimit.max

  if (count(ROLES.SETTER) > maxSetters) {
    violations.push({
      code: 'TOO_MANY_SETTERS',
      message: hasOpposite
        ? 'С диагональным в шестёрке может быть только одна связка'
        : 'В шестёрке больше двух связок',
    })
  }

  return violations
}

function liberoViolations(lineup, roster) {
  if (!lineup.liberoId) return []

  const player = findPlayer(roster, lineup.liberoId)
  if (player && player.role === ROLES.LIBERO) return []

  return [
    {
      code: 'NOT_A_LIBERO',
      message: 'В либеро можно назначить только игрока с ролью «Либеро»',
    },
  ]
}

function fullName(roster, playerId) {
  const player = findPlayer(roster, playerId)
  return player ? `${player.firstName} ${player.lastName}` : playerId
}
