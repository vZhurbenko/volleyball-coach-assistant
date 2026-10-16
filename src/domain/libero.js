import { ROLES } from './constants.js'
import { slotInZone } from './rotation.js'
import { TEAMS } from './score.js'

/**
 * Либеро выходит вместо ЦБ, оказавшегося на задней линии, и уходит, когда тот
 * возвращается на переднюю.
 *
 * Отдельных событий выхода либеро нет: он считается из состояния — расстановки,
 * ротации и подачи. Поэтому лимит замен либеро не расходует и в журнал не пишется.
 */

/**
 * Зоны задней линии в порядке движения по часовой стрелке: 1 → 6 → 5.
 * Порядок задаёт выбор, если на задней линии оказались оба ЦБ: берём того, кто
 * только что ротировал с передней линии, — он стоит в зоне 1.
 */
const BACK_LINE = [1, 6, 5]

/**
 * Где выходит либеро. Мы в приёме, когда подаёт соперник.
 *
 * @param {object} params
 * @param {import('./lineup.js').Lineup} params.lineup — расстановка партии
 * @param {number} params.rotations
 * @param {string | null} params.liberoId
 * @param {'us' | 'them'} params.serving
 * @returns {number | null} — зона, в которой стоит либеро, или null, если он не в игре
 */
export function liberoZone({ lineup, rotations, liberoId, serving }) {
  if (!liberoId || serving !== TEAMS.THEM) return null

  const zone = BACK_LINE.find(
    (each) => roleInZone(lineup, rotations, each) === ROLES.MIDDLE_BLOCKER,
  )

  return zone ?? null
}

function roleInZone(lineup, rotations, zone) {
  return lineup.zones[slotInZone(zone, rotations)]?.role ?? null
}
