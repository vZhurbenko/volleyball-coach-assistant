/**
 * Серии очков: «соперник +3, мы +2, …» — сколько очков команда взяла подряд.
 *
 * Серия строится от истории очков целиком, поэтому отмена очка — это просто
 * пересчёт по укороченной истории, без отдельной логики.
 */

/**
 * @typedef {object} PointStreak
 * @property {number} setNumber
 * @property {'us' | 'them'} team
 * @property {number} points — сколько очков подряд
 */

/**
 * Строит серии очков. Партия закрывает серию: на границе партии мяч мёртв,
 * счёт и подача начинаются заново, так что переносить разбег через неё нечего.
 *
 * @param {{ setNumber: number, team: 'us' | 'them' }[]} history — очки по порядку
 * @returns {PointStreak[]}
 */
export function pointStreaks(history) {
  const streaks = []

  for (const { setNumber, team } of history) {
    const running = streaks[streaks.length - 1]

    if (running && running.team === team && running.setNumber === setNumber) {
      running.points += 1
    } else {
      streaks.push({ setNumber, team, points: 1 })
    }
  }

  return streaks
}
