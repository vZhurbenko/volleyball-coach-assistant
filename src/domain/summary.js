/**
 * Текстовая сводка матча в Markdown: результат, статистика по партиям
 * и за матч, замены.
 *
 * Нужна для обмена итогами там, где печать недоступна или неудобна, —
 * например, в установленном PWA на iOS, где `window.print()` не работает.
 */

import { findPlayer } from './players.js'
import { setsWon } from './score.js'
import { STAT_LABELS, STAT_TYPES, countersForPlayer, countersForSet } from './stats.js'

const STAT_TYPE_LIST = Object.values(STAT_TYPES)

const tableHeader = `| Игрок | ${STAT_TYPE_LIST.map((type) => STAT_LABELS[type]).join(' | ')} |`
const tableSeparator = `| --- | ${STAT_TYPE_LIST.map(() => '---:').join(' | ')} |`

function playerName(player) {
  return player ? `${player.firstName} ${player.lastName}` : '—'
}

/** Markdown-таблица со статистикой игроков, у которых есть хотя бы один факт. */
function statsTable(roster, countersByPlayer) {
  const rows = roster
    .filter((player) => countersByPlayer[player.id])
    .filter((player) => STAT_TYPE_LIST.some((type) => countersByPlayer[player.id][type] > 0))
    .map((player) => {
      const counters = countersByPlayer[player.id]
      const cells = STAT_TYPE_LIST.map((type) => counters[type] ?? 0).join(' | ')
      return `| №${player.number} ${player.lastName} | ${cells} |`
    })

  return rows.length ? [tableHeader, tableSeparator, ...rows] : ['_Статистика не велась_']
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
  const lines = [`# ${teamName} — ${opponent}`, '', `**Счёт: ${won.us}:${won.them}**`]

  for (const set of state.score.sets) {
    lines.push('', `## Партия ${set.number}: ${set.points.us}:${set.points.them}`)
    lines.push('', ...statsTable(roster, countersForSet(stats, set.number)))
  }

  const totals = Object.fromEntries(
    roster.map((player) => [player.id, countersForPlayer(stats, player.id)]),
  )

  lines.push('', '## За матч')
  lines.push('', ...statsTable(roster, totals))

  const exceptional = state.substitutions?.exceptional ?? []
  const retired = state.substitutions?.retired ?? []

  if (exceptional.length || retired.length) {
    lines.push('', '## Замены', '')

    for (const { outgoingId, incomingId } of exceptional) {
      const outgoing = playerName(findPlayer(roster, outgoingId))
      const incoming = playerName(findPlayer(roster, incomingId))
      lines.push(`- Исключительные: ${outgoing} → ${incoming} (выбыл: ${outgoing})`)
    }

    if (retired.length) {
      const names = retired.map((playerId) => playerName(findPlayer(roster, playerId))).join(', ')
      lines.push(`- Выбывшие: ${names}`)
    }
  }

  return lines.join('\n')
}
