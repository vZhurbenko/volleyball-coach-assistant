/**
 * Счёт матча: очки партии, партии матча, подача.
 *
 * Победители партий и матча не хранятся, а выводятся из очков — так состояние
 * пересчитывается из журнала событий без рассинхронизации (см. #11).
 */

/** Команды: мы и соперник. */
export const TEAMS = { US: 'us', THEM: 'them' }

export const SET_RULES = {
  /** Партия идёт до 25 очков… */
  POINTS_TO_WIN: 25,
  /** …а решающая пятая — до 15. */
  TIEBREAK_POINTS_TO_WIN: 15,
  TIEBREAK_SET: 5,
  /** Победа в партии — с разницей не меньше двух очков. */
  MIN_LEAD: 2,
  /** Матч идёт до трёх побед, то есть максимум пять партий. */
  SETS_TO_WIN: 3,
}

/**
 * @typedef {object} SetScore
 * @property {number} number — номер партии, 1–5
 * @property {{ us: number, them: number }} points
 */

/**
 * @typedef {object} MatchScore
 * @property {SetScore[]} sets — все партии матча, последняя — текущая
 * @property {'us' | 'them'} serving — кто подаёт
 */

/**
 * @param {'us' | 'them'} serving
 * @returns {MatchScore}
 */
export function initialScore(serving) {
  return { sets: [emptySet(1)], serving }
}

/** @param {MatchScore} score */
export function currentSet(score) {
  return score.sets[score.sets.length - 1]
}

/** @param {number} setNumber */
export function pointsToWin(setNumber) {
  return setNumber === SET_RULES.TIEBREAK_SET
    ? SET_RULES.TIEBREAK_POINTS_TO_WIN
    : SET_RULES.POINTS_TO_WIN
}

/**
 * Победитель партии или null, пока партия не доиграна.
 *
 * @param {SetScore} set
 * @returns {'us' | 'them' | null}
 */
export function setWinner(set) {
  const { us, them } = set.points
  const lead = Math.abs(us - them)

  if (Math.max(us, them) < pointsToWin(set.number) || lead < SET_RULES.MIN_LEAD) return null

  return us > them ? TEAMS.US : TEAMS.THEM
}

/** @param {SetScore} set */
export function isSetOver(set) {
  return setWinner(set) !== null
}

/**
 * Сколько партий взяла каждая команда.
 *
 * @param {MatchScore} score
 * @returns {{ us: number, them: number }}
 */
export function setsWon(score) {
  const won = { us: 0, them: 0 }
  for (const set of score.sets) {
    const winner = setWinner(set)
    if (winner) won[winner] += 1
  }
  return won
}

/**
 * @param {MatchScore} score
 * @returns {'us' | 'them' | null}
 */
export function matchWinner(score) {
  const won = setsWon(score)
  if (won.us >= SET_RULES.SETS_TO_WIN) return TEAMS.US
  if (won.them >= SET_RULES.SETS_TO_WIN) return TEAMS.THEM
  return null
}

/** @param {MatchScore} score */
export function isMatchOver(score) {
  return matchWinner(score) !== null
}

/**
 * Начисляет очко. Очко забившей команде и подача ей же — по системе «rally point».
 * Когда партия или матч кончились, счёт не меняется.
 *
 * @param {MatchScore} score
 * @param {'us' | 'them'} team
 * @returns {MatchScore}
 */
export function addPoint(score, team) {
  if (isMatchOver(score) || isSetOver(currentSet(score))) return score

  const sets = [...score.sets]
  const running = currentSet(score)

  sets[sets.length - 1] = {
    ...running,
    points: { ...running.points, [team]: running.points[team] + 1 },
  }

  return { sets, serving: team }
}

/**
 * Открывает следующую партию. Кто подаёт первым, решает вызывающий —
 * по FIVB это команда, не подававшая первой в предыдущей партии (см. #27).
 *
 * @param {MatchScore} score
 * @param {'us' | 'them'} serving
 * @returns {MatchScore}
 */
export function startNextSet(score, serving) {
  if (isMatchOver(score) || !isSetOver(currentSet(score))) return score

  return { sets: [...score.sets, emptySet(score.sets.length + 1)], serving }
}

/** @param {number} number */
function emptySet(number) {
  return { number, points: { us: 0, them: 0 } }
}
