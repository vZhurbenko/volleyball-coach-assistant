import { ZONES } from './constants.js'
import { liberoZone } from './libero.js'
import { rotates, slotInZone } from './rotation.js'
import { addPoint, initialScore, startNextSet } from './score.js'
import { addStat, initStats } from './stats.js'
import { initSubstitutions, playerInSlot, substitute } from './substitutions.js'
import { pointStreaks } from './streaks.js'

/**
 * Журнал матча и сборка состояния из него.
 *
 * Журнал — источник истины: в нём одни события, а счёт, подача, ротация, состав
 * на площадке, серии и статистика из него выводятся. Поэтому отмена очка —
 * это удаление события и пересчёт, а не правка состояния по месту.
 */

/** События журнала. */
export const EVENT_TYPES = {
  /** Начало партии: расстановка и кто подаёт первым. */
  SET_START: 'setStart',
  /** Очко: кто взял. */
  POINT: 'point',
  /** Факт статистики: игрок и что именно. */
  STAT: 'stat',
  /** Замена: кто ушёл, кто вышел и не исключительная ли она. */
  SUBSTITUTION: 'substitution',
}

/**
 * @typedef {object} MatchState
 * @property {number} setNumber
 * @property {import('./score.js').MatchScore} score
 * @property {import('./lineup.js').Lineup} lineup — расстановка на начало партии, слоты
 * @property {number} rotations — сколько сдвигов сделано в партии
 * @property {import('./substitutions.js').Substitutions} substitutions
 * @property {import('./stats.js').MatchStats} stats
 * @property {{ setNumber: number, team: 'us' | 'them' }[]} history — очки по порядку
 * @property {import('./streaks.js').PointStreak[]} streaks
 */

/**
 * Собирает состояние матча из журнала. Пустой журнал — матч ещё не начат.
 *
 * Неизвестные события пропускаются: журнал приходит из хранилища, и устаревшая
 * запись не должна ронять приложение.
 *
 * @param {object[]} events
 * @returns {MatchState | null}
 */
export function matchState(events) {
  const state = foldEvents(events)
  if (!state) return null

  return { ...state, streaks: pointStreaks(state.history) }
}

/**
 * Кто стоит в каждой зоне площадки: расстановка партии, сдвинутая ротацией,
 * с учётом замен и выхода либеро.
 *
 * @param {MatchState} state
 * @returns {Record<number, string>}
 */
export function playersOnCourt(state) {
  const zones = {}

  for (const zone of ZONES) {
    zones[zone] = playerInSlot(state.substitutions, slotInZone(zone, state.rotations))
  }

  const libero = liberoZone({
    lineup: state.lineup,
    rotations: state.rotations,
    liberoId: state.lineup.liberoId,
    serving: state.score.serving,
  })
  if (libero !== null) zones[libero] = state.lineup.liberoId

  return zones
}

/**
 * Убирает из журнала последнее очко — так отменяется очко, нажатое по ошибке.
 * Статистика и замены остаются: они не откатываются.
 *
 * @param {object[]} events
 * @returns {object[]} — новый журнал, исходный не трогается
 */
export function undoLastPoint(events) {
  const index = events.findLastIndex((event) => event.type === EVENT_TYPES.POINT)
  if (index === -1) return events

  return [...events.slice(0, index), ...events.slice(index + 1)]
}

function foldEvents(events) {
  let state = null
  for (const event of events) {
    state = applyEvent(state, event)
  }
  return state
}

function applyEvent(state, event) {
  if (event.type === EVENT_TYPES.SET_START) return startSet(state, event)
  if (!state) return null

  switch (event.type) {
    case EVENT_TYPES.POINT:
      return scorePoint(state, event)
    case EVENT_TYPES.STAT:
      return recordStat(state, event)
    case EVENT_TYPES.SUBSTITUTION:
      return recordSubstitution(state, event)
    default:
      return state
  }
}

function startSet(state, { lineup, serving }) {
  return {
    setNumber: (state?.setNumber ?? 0) + 1,
    score: state ? startNextSet(state.score, serving) : initialScore(serving),
    lineup,
    rotations: 0,
    substitutions: initSubstitutions(lineup, state?.substitutions),
    stats: state?.stats ?? initStats(),
    history: state?.history ?? [],
  }
}

function scorePoint(state, { team }) {
  const score = addPoint(state.score, team)
  if (score === state.score) return state

  return {
    ...state,
    score,
    rotations: state.rotations + (rotates(state.score.serving, team) ? 1 : 0),
    history: [...state.history, { setNumber: state.setNumber, team }],
  }
}

function recordStat(state, { playerId, statType }) {
  return {
    ...state,
    stats: addStat(state.stats, { setNumber: state.setNumber, playerId, type: statType }),
  }
}

function recordSubstitution(state, { outgoingId, incomingId, exceptional = false }) {
  const result = substitute(state.substitutions, { outgoingId, incomingId, exceptional })
  if (!result.ok) return state

  return { ...state, substitutions: result.state }
}
