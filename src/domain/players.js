import { ROLES } from './constants.js'

/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {number} number — игровой номер
 * @property {string} role — одна из ролей `ROLES`
 * @property {number} [startingZone] — зона в дефолтной стартовой шестёрке
 */

/**
 * Состав команды. Захардкожен: редактирования состава в UI нет.
 *
 * У шести игроков основы указана стартовая зона; остальные — запасные.
 * Либеро в текущем составе команды нет.
 *
 * @type {Player[]}
 */
export const TEAM_ROSTER = [
  {
    id: 'zhurbenko',
    firstName: 'Владислав',
    lastName: 'Журбенко',
    number: 3,
    role: ROLES.MIDDLE_BLOCKER,
  },
  {
    id: 'panchishkina',
    firstName: 'Мария',
    lastName: 'Панчишкина',
    number: 5,
    role: ROLES.SETTER,
    startingZone: 4,
  },
  {
    id: 'gorobchenko',
    firstName: 'Роман',
    lastName: 'Горобченко',
    number: 10,
    role: ROLES.OPPOSITE,
  },
  {
    id: 'gromov',
    firstName: 'Вадим',
    lastName: 'Громов',
    number: 11,
    role: ROLES.MIDDLE_BLOCKER,
    startingZone: 3,
  },
  {
    id: 'emelyanov',
    firstName: 'Денис',
    lastName: 'Емельянов',
    number: 12,
    role: ROLES.MIDDLE_BLOCKER,
  },
  {
    id: 'verzhenovsky',
    firstName: 'Владислав',
    lastName: 'Верженовский',
    number: 14,
    role: ROLES.OUTSIDE_HITTER,
    startingZone: 2,
  },
  {
    id: 'timofeev',
    firstName: 'Андрей',
    lastName: 'Тимофеев',
    number: 17,
    role: ROLES.OUTSIDE_HITTER,
  },
  {
    id: 'komissarov',
    firstName: 'Федров',
    lastName: 'Комиссаров',
    number: 50,
    role: ROLES.MIDDLE_BLOCKER,
    startingZone: 6,
  },
  {
    id: 'abroskin',
    firstName: 'Илья',
    lastName: 'Аброскин',
    number: 9,
    role: ROLES.OUTSIDE_HITTER,
    startingZone: 5,
  },
  {
    id: 'fatkulin',
    firstName: 'Рафкат',
    lastName: 'Фаткулин',
    number: 9,
    role: ROLES.SETTER,
  },
  {
    id: 'titov',
    firstName: 'Александр',
    lastName: 'Титов',
    number: 2,
    role: ROLES.OPPOSITE,
    startingZone: 1,
  },
]

/**
 * @param {Player[]} roster
 * @param {string} playerId
 * @returns {Player | undefined}
 */
export function findPlayer(roster, playerId) {
  return roster.find((player) => player.id === playerId)
}
