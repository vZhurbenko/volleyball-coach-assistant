/**
 * Статистика игрока: количество фактов без оценок качества и без зон.
 *
 * Считается по партиям отдельно — статистика каждой партии начинается с нуля,
 * а за матч счётчики складываются. Числа выводятся из журнала событий, поэтому
 * структура пересобирается редьюсером (см. #11).
 */

/** Пять фактов, которые считает тренер. */
export const STAT_TYPES = {
  POINT: 'point',
  SERVE: 'serve',
  SERVE_ERROR: 'serve_error',
  ERROR: 'error',
  BLOCK: 'block',
}

/** Подписи фактов для меню игрока. */
export const STAT_LABELS = {
  [STAT_TYPES.POINT]: '+очко',
  [STAT_TYPES.SERVE]: '+подача',
  [STAT_TYPES.SERVE_ERROR]: '+ошибка на подаче',
  [STAT_TYPES.ERROR]: '+общая ошибка',
  [STAT_TYPES.BLOCK]: '+блок',
}

/**
 * @typedef {Record<string, number>} Counters — значения по каждому из `STAT_TYPES`
 */

/**
 * @typedef {object} MatchStats
 * @property {Record<string, Counters>[]} sets — статистика партий, индекс = номер партии − 1
 */

/** @returns {Counters} */
export function emptyCounters() {
  return Object.fromEntries(Object.values(STAT_TYPES).map((type) => [type, 0]))
}

/** @returns {MatchStats} */
export function initStats() {
  return { sets: [] }
}

/**
 * Записывает факт игроку. Партия, которой ещё нет в списке, заводится пустой.
 *
 * @param {MatchStats} stats
 * @param {{ setNumber: number, playerId: string, type: string }} fact
 * @returns {MatchStats}
 */
export function addStat(stats, { setNumber, playerId, type }) {
  const sets = [...stats.sets]
  while (sets.length < setNumber) sets.push({})

  const counters = sets[setNumber - 1][playerId] ?? emptyCounters()
  sets[setNumber - 1] = {
    ...sets[setNumber - 1],
    [playerId]: { ...counters, [type]: counters[type] + 1 },
  }

  return { sets }
}

/**
 * Статистика всех игроков в партии — для разбивки по партиям в итогах.
 *
 * @param {MatchStats} stats
 * @param {number} setNumber
 * @returns {Record<string, Counters>}
 */
export function countersForSet(stats, setNumber) {
  return stats.sets[setNumber - 1] ?? {}
}

/**
 * Статистика игрока за весь матч: суммы по партиям.
 * Игрок без единого факта получает нули.
 *
 * @param {MatchStats} stats
 * @param {string} playerId
 * @returns {Counters}
 */
export function countersForPlayer(stats, playerId) {
  const total = emptyCounters()

  for (const set of stats.sets) {
    const counters = set[playerId]
    if (!counters) continue

    for (const type of Object.values(STAT_TYPES)) {
      total[type] += counters[type]
    }
  }

  return total
}
