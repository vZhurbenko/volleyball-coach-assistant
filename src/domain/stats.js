/**
 * Статистика игрока: количество фактов без оценок качества и без зон.
 *
 * Считается по партиям отдельно — статистика каждой партии начинается с нуля,
 * а за матч счётчики складываются. Числа выводятся из журнала событий, поэтому
 * структура пересобирается редьюсером (см. #11).
 */

/** Шесть фактов, которые считает тренер. Порядок — порядок кнопок в меню. */
export const STAT_TYPES = {
  POINT: 'point',
  SERVE: 'serve',
  BLOCK: 'block',
  ERROR: 'error',
  RECEPTION_ERROR: 'reception_error',
  SERVE_ERROR: 'serve_error',
}

/** Подписи фактов для меню игрока. */
export const STAT_LABELS = {
  [STAT_TYPES.POINT]: 'очко',
  [STAT_TYPES.SERVE]: 'подача',
  [STAT_TYPES.BLOCK]: 'блок',
  [STAT_TYPES.ERROR]: 'ошибка',
  [STAT_TYPES.RECEPTION_ERROR]: 'ошибка в приёме',
  [STAT_TYPES.SERVE_ERROR]: 'ошибка на подаче',
}

/** Тон факта: положительный или отрицательный — для цвета в меню. */
export const STAT_TONES = {
  [STAT_TYPES.POINT]: 'positive',
  [STAT_TYPES.SERVE]: 'positive',
  [STAT_TYPES.BLOCK]: 'positive',
  [STAT_TYPES.ERROR]: 'negative',
  [STAT_TYPES.RECEPTION_ERROR]: 'negative',
  [STAT_TYPES.SERVE_ERROR]: 'negative',
}

const POINT_TYPES = Object.values(STAT_TYPES).filter(
  (type) => STAT_TONES[type] === 'positive',
)
const ERROR_TYPES = Object.values(STAT_TYPES).filter(
  (type) => STAT_TONES[type] === 'negative',
)

/**
 * @typedef {Record<string, number>} Counters — значения по каждому из `STAT_TYPES`
 */

/**
 * Сумма положительных фактов: очки, подачи и блоки.
 *
 * @param {Counters} counters
 * @returns {number}
 */
export function pointsTotal(counters) {
  return POINT_TYPES.reduce((total, type) => total + (counters[type] ?? 0), 0)
}

/**
 * Сумма ошибок: ошибка, ошибка в приёме и ошибка на подаче.
 *
 * @param {Counters} counters
 * @returns {number}
 */
export function errorsTotal(counters) {
  return ERROR_TYPES.reduce((total, type) => total + (counters[type] ?? 0), 0)
}

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
    [playerId]: { ...counters, [type]: (counters[type] ?? 0) + 1 },
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
      total[type] += counters[type] ?? 0
    }
  }

  return total
}
