import { ZONES } from './constants.js'
import { TEAMS } from './score.js'

/**
 * Ротация: сдвиг шестёрки на одну зону по часовой стрелке при переходе подачи.
 *
 * Отдельной нумерации расстановок 1–6 нет — тренер её не переключает,
 * игроки просто смещаются сами (см. docs/requirements.md, «Площадка»).
 */

/** Куда переходит игрок каждой зоны: 2→1, 3→2, …, 1→6. */
export const ROTATION = Object.fromEntries(
  ZONES.map((zone) => [zone, zone === 1 ? ZONES.length : zone - 1]),
)

/**
 * Сдвигает шестёрку на одну зону по часовой стрелке.
 * Роль едет вместе с игроком, либеро остаётся назначенным.
 *
 * @param {import('./lineup.js').Lineup} lineup
 * @returns {import('./lineup.js').Lineup}
 */
export function rotate(lineup) {
  const zones = {}
  for (const zone of ZONES) {
    zones[ROTATION[zone]] = lineup.zones[zone]
  }

  return { ...lineup, zones }
}

/**
 * Сдвигаемся ли мы после розыгрыша. Сдвиг — только при переходе подачи к нам,
 * то есть когда очко взято на чужой подаче. Очко на своей подаче сдвига не даёт.
 *
 * @param {'us' | 'them'} servingBefore — кто подавал до розыгрыша
 * @param {'us' | 'them'} scoredBy — кто взял очко
 */
export function rotates(servingBefore, scoredBy) {
  return scoredBy === TEAMS.US && servingBefore !== TEAMS.US
}
