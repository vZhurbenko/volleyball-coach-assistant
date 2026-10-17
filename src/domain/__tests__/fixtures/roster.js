import { ROLES } from '../../constants.js'

/**
 * Тестовый состав команды.
 *
 * Роли, номера и стартовые зоны подобраны так, чтобы проверять правила схемы
 * 5-1, переопределение ролей, замены и либеро. Это не состав реальной команды —
 * он лежит в `players.js`.
 *
 * @type {import('../../players.js').Player[]}
 */
export const MOCK_ROSTER = [
  {
    id: 'belov',
    firstName: 'Артём',
    lastName: 'Белов',
    number: 7,
    role: ROLES.SETTER,
    startingZone: 1,
  },
  { id: 'krylov', firstName: 'Дмитрий', lastName: 'Крылов', number: 11, role: ROLES.SETTER },
  {
    id: 'efimov',
    firstName: 'Максим',
    lastName: 'Ефимов',
    number: 9,
    role: ROLES.OPPOSITE,
    startingZone: 4,
  },
  { id: 'savelev', firstName: 'Игорь', lastName: 'Савельев', number: 17, role: ROLES.OPPOSITE },
  {
    id: 'sokolov',
    firstName: 'Никита',
    lastName: 'Соколов',
    number: 4,
    role: ROLES.OUTSIDE_HITTER,
    startingZone: 2,
  },
  {
    id: 'lebedev',
    firstName: 'Егор',
    lastName: 'Лебедев',
    number: 5,
    role: ROLES.OUTSIDE_HITTER,
    startingZone: 5,
  },
  { id: 'gusev', firstName: 'Роман', lastName: 'Гусев', number: 8, role: ROLES.OUTSIDE_HITTER },
  { id: 'orlov', firstName: 'Павел', lastName: 'Орлов', number: 15, role: ROLES.OUTSIDE_HITTER },
  {
    id: 'morozov',
    firstName: 'Андрей',
    lastName: 'Морозов',
    number: 3,
    role: ROLES.MIDDLE_BLOCKER,
    startingZone: 3,
  },
  {
    id: 'volkov',
    firstName: 'Сергей',
    lastName: 'Волков',
    number: 12,
    role: ROLES.MIDDLE_BLOCKER,
    startingZone: 6,
  },
  {
    id: 'tikhonov',
    firstName: 'Илья',
    lastName: 'Тихонов',
    number: 14,
    role: ROLES.MIDDLE_BLOCKER,
  },
  { id: 'zimin', firstName: 'Кирилл', lastName: 'Зимин', number: 1, role: ROLES.LIBERO },
]
