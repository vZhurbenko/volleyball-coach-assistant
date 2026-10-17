import { COURT_ROLES, ROLES, ZONES } from './constants.js'
import { findPlayer } from './players.js'

/**
 * Ростер команды: проверка, нормализация и операции, которые меняют шестёрку
 * вместе с составом. Чистые функции без обращения к хранилищу.
 */

/**
 * Порядок состава во всех списках приложения: по игровому номеру, затем по
 * фамилии и имени. Одинаковые номера в команде встречаются, поэтому нужен
 * предсказуемый второй ключ. Исходный массив не меняется.
 *
 * @param {import('./players.js').Player[]} roster
 * @returns {import('./players.js').Player[]}
 */
export function sortRoster(roster) {
  return [...roster].sort(
    (first, second) =>
      first.number - second.number ||
      first.lastName.localeCompare(second.lastName, 'ru') ||
      first.firstName.localeCompare(second.firstName, 'ru'),
  )
}

/** @param {unknown} role */
function isKnownRole(role) {
  return COURT_ROLES.includes(role) || role === ROLES.LIBERO
}

/** @param {unknown} value */
export function isPlayer(value) {
  if (!value || typeof value !== 'object') return false
  if (typeof value.id !== 'string' || value.id === '') return false
  if (typeof value.firstName !== 'string' || value.firstName.trim() === '') return false
  if (typeof value.lastName !== 'string' || value.lastName.trim() === '') return false
  if (!Number.isInteger(value.number) || value.number < 1 || value.number > 99) return false

  return isKnownRole(value.role)
}

/** @param {unknown} value */
export function isRoster(value) {
  if (!Array.isArray(value)) return false

  const ids = new Set()
  for (const player of value) {
    if (!isPlayer(player) || ids.has(player.id)) return false
    ids.add(player.id)
  }

  return true
}

/**
 * @param {{ firstName?: string, lastName?: string, number?: unknown, role?: string }} input
 * @returns {{ valid: boolean, violations: Array<{ code: string, field: string, message: string }> }}
 */
export function validatePlayer(input = {}) {
  const violations = []
  const firstName = typeof input.firstName === 'string' ? input.firstName.trim() : ''
  const lastName = typeof input.lastName === 'string' ? input.lastName.trim() : ''
  const number = Number(input.number)

  if (!firstName) {
    violations.push({ code: 'FIRST_NAME_REQUIRED', field: 'firstName', message: 'Укажите имя' })
  }
  if (!lastName) {
    violations.push({ code: 'LAST_NAME_REQUIRED', field: 'lastName', message: 'Укажите фамилию' })
  }
  if (!Number.isInteger(number) || number < 1 || number > 99) {
    violations.push({
      code: 'INVALID_NUMBER',
      field: 'number',
      message: 'Номер — целое число от 1 до 99',
    })
  }
  if (!isKnownRole(input.role)) {
    violations.push({ code: 'INVALID_ROLE', field: 'role', message: 'Выберите роль' })
  }

  return { valid: violations.length === 0, violations }
}

/**
 * Собирает игрока для хранения: тримминг имени и фамилии, номер числом.
 * `startingZone` и прочие поля отбрасываются — дефолтная шестёрка живёт отдельно.
 *
 * @param {object} input
 * @param {string} id
 * @returns {import('./players.js').Player}
 */
export function createPlayer(input, id) {
  return {
    id,
    firstName: String(input.firstName ?? '').trim(),
    lastName: String(input.lastName ?? '').trim(),
    number: Number(input.number),
    role: input.role,
  }
}

/**
 * Убирает игрока из всех зон и из слота либеро. Исходная шестёрка не меняется.
 *
 * @param {import('./lineup.js').Lineup} lineup
 * @param {string} playerId
 * @returns {import('./lineup.js').Lineup}
 */
export function removePlayerFromLineup(lineup, playerId) {
  const zones = Object.fromEntries(
    ZONES.map((zone) => {
      const assignment = lineup?.zones?.[zone] ?? null
      return [zone, assignment?.playerId === playerId ? null : assignment]
    }),
  )

  return {
    zones,
    liberoId: lineup?.liberoId === playerId ? null : (lineup?.liberoId ?? null),
  }
}

/**
 * Переносит смену роли из состава в шестёрку. Меняются только роли-снапшоты,
 * которые всё ещё равны прежней роли; ручные переопределения сохраняются.
 * Переход в либеро убирает игрока из зон, уход из либеро чистит слот.
 *
 * @param {import('./lineup.js').Lineup} lineup
 * @param {string} playerId
 * @param {string} previousRole
 * @param {string} nextRole
 * @returns {import('./lineup.js').Lineup}
 */
export function applyRoleChange(lineup, playerId, previousRole, nextRole) {
  if (nextRole === ROLES.LIBERO) return removePlayerFromLineup(lineup, playerId)

  const zones = Object.fromEntries(
    ZONES.map((zone) => {
      const assignment = lineup?.zones?.[zone] ?? null
      const next =
        assignment?.playerId === playerId && assignment.role === previousRole
          ? { ...assignment, role: nextRole }
          : assignment
      return [zone, next]
    }),
  )

  return {
    zones,
    liberoId: lineup?.liberoId === playerId ? null : (lineup?.liberoId ?? null),
  }
}

/**
 * Приводит сохранённую шестёрку в согласие с составом: убирает удалённых,
 * либеро в зонах и неизвестные роли. Используется при загрузке из хранилища.
 *
 * @param {import('./lineup.js').Lineup | null} lineup
 * @param {import('./players.js').Player[]} roster
 * @returns {import('./lineup.js').Lineup}
 */
export function reconcileLineup(lineup, roster) {
  const zones = Object.fromEntries(
    ZONES.map((zone) => {
      const assignment = lineup?.zones?.[zone] ?? null
      if (!assignment) return [zone, null]

      const player = findPlayer(roster, assignment.playerId)
      if (!player || player.role === ROLES.LIBERO) return [zone, null]

      const role = COURT_ROLES.includes(assignment.role) ? assignment.role : player.role
      return [zone, { playerId: player.id, role }]
    }),
  )

  const libero = findPlayer(roster, lineup?.liberoId ?? null)

  return {
    zones,
    liberoId: libero?.role === ROLES.LIBERO ? libero.id : null,
  }
}
