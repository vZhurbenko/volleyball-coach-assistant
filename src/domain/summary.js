/**
 * Текстовая сводка матча: результат, статистика по партиям и за матч, замены.
 *
 * Нужна для обмена итогами там, где печать недоступна или неудобна, —
 * например, в установленном PWA на iOS, где `window.print()` не работает.
 */

import { findPlayer } from './players.js'
import { setsWon } from './score.js'
import { STAT_LABELS, STAT_TYPES, countersForPlayer, countersForSet } from './stats.js'

const STAT_TYPE_LIST = Object.values(STAT_TYPES)

function playerName(player) {
  return player ? `${player.firstName} ${player.lastName}` : '—'
}

function formatCounters(counters) {
  return STAT_TYPE_LIST.filter((type) => counters[type] > 0)
    .map((type) => `${STAT_LABELS[type]} ${counters[type]}`)
    .join(', ')
}

/** Строки статистики только для игроков с ненулевыми счётчиками. */
function statRows(roster, countersByPlayer) {
  const rows = []

  for (const player of roster) {
    const counters = countersByPlayer[player.id]
    if (!counters) continue

    const facts = formatCounters(counters)
    if (facts) rows.push(`№${player.number} ${player.lastName}: ${facts}`)
  }

  return rows
}

/**
 * @param {object} params
 * @param {object} params.state — состояние матча
 * @param {object} [params.settings] — названия команд
 * @param {object[]} params.roster
 * @returns {string}
 */
export function buildSummaryText({ state, settings = {}, roster }) {
  if (!state) return ''

  const teamName = settings.teamName || 'Мы'
  const opponent = settings.opponent || 'Соперник'
  const won = setsWon(state.score)
  const stats = state.stats ?? { sets: [] }
  const lines = [`${teamName} — ${opponent}`, `Счёт: ${won.us}:${won.them}`]

  for (const set of state.score.sets) {
    lines.push('', `Партия ${set.number}: ${set.points.us}:${set.points.them}`)

    const rows = statRows(roster, countersForSet(stats, set.number))
    lines.push(...(rows.length ? rows : ['Статистика не велась']))
  }

  const totalRows = roster.flatMap((player) => {
    const facts = formatCounters(countersForPlayer(stats, player.id))
    return facts ? [`№${player.number} ${player.lastName}: ${facts}`] : []
  })

  lines.push('', 'За матч')
  lines.push(...(totalRows.length ? totalRows : ['Статистика не велась']))

  const exceptional = state.substitutions?.exceptional ?? []
  const retired = state.substitutions?.retired ?? []

  if (exceptional.length || retired.length) {
    lines.push('')

    if (exceptional.length) {
      lines.push('Исключительные замены')
      for (const { outgoingId, incomingId } of exceptional) {
        const outgoing = playerName(findPlayer(roster, outgoingId))
        const incoming = playerName(findPlayer(roster, incomingId))
        lines.push(`${outgoing} → ${incoming} (выбыл: ${outgoing})`)
      }
    }

    if (retired.length) {
      lines.push(
        `Выбывшие: ${retired.map((playerId) => playerName(findPlayer(roster, playerId))).join(', ')}`,
      )
    }
  }

  return lines.join('\n')
}
