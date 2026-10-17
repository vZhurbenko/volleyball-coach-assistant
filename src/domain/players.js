/**
 * @typedef {object} Player
 * @property {string} id
 * @property {string} firstName
 * @property {string} lastName
 * @property {number} number — игровой номер
 * @property {string} role — одна из ролей `ROLES`
 * @property {number} [startingZone] — зона при сборке шестёрки из тестовых данных
 */

/**
 * Встроенного состава в приложении нет: новый пользователь начинает с пустого
 * ростера и набирает свою команду в настройках состава (или импортирует JSON).
 * Поэтому здесь остались только тип игрока и поиск по составу.
 */

/**
 * @param {Player[]} roster
 * @param {string} playerId
 * @returns {Player | undefined}
 */
export function findPlayer(roster, playerId) {
  return roster.find((player) => player.id === playerId)
}
