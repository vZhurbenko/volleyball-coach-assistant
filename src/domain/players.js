import { ROLES } from './constants.js'

/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {number} number — игровой номер
 * @property {string} role — одна из ролей `ROLES`
 */

/**
 * Мок-состав: фиктивные игроки вместо реальной команды, чтобы сценарий
 * проходился целиком. Либеро в текущем составе команды нет, но он есть здесь —
 * без него не проверить замены либеро.
 *
 * @type {Player[]}
 */
export const MOCK_ROSTER = [
  { id: 'belov', firstName: 'Артём', lastName: 'Белов', number: 7, role: ROLES.SETTER },
  { id: 'krylov', firstName: 'Дмитрий', lastName: 'Крылов', number: 11, role: ROLES.SETTER },
  { id: 'efimov', firstName: 'Максим', lastName: 'Ефимов', number: 9, role: ROLES.OPPOSITE },
  { id: 'savelev', firstName: 'Игорь', lastName: 'Савельев', number: 17, role: ROLES.OPPOSITE },
  {
    id: 'sokolov',
    firstName: 'Никита',
    lastName: 'Соколов',
    number: 4,
    role: ROLES.OUTSIDE_HITTER,
  },
  { id: 'lebedev', firstName: 'Егор', lastName: 'Лебедев', number: 5, role: ROLES.OUTSIDE_HITTER },
  { id: 'gusev', firstName: 'Роман', lastName: 'Гусев', number: 8, role: ROLES.OUTSIDE_HITTER },
  { id: 'orlov', firstName: 'Павел', lastName: 'Орлов', number: 15, role: ROLES.OUTSIDE_HITTER },
  {
    id: 'morozov',
    firstName: 'Андрей',
    lastName: 'Морозов',
    number: 3,
    role: ROLES.MIDDLE_BLOCKER,
  },
  { id: 'volkov', firstName: 'Сергей', lastName: 'Волков', number: 12, role: ROLES.MIDDLE_BLOCKER },
  {
    id: 'tikhonov',
    firstName: 'Илья',
    lastName: 'Тихонов',
    number: 14,
    role: ROLES.MIDDLE_BLOCKER,
  },
  { id: 'zimin', firstName: 'Кирилл', lastName: 'Зимин', number: 1, role: ROLES.LIBERO },
]

/**
 * @param {Player[]} roster
 * @param {string} playerId
 * @returns {Player | undefined}
 */
export function findPlayer(roster, playerId) {
  return roster.find((player) => player.id === playerId)
}
