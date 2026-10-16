import { MATCH_RULES, ZONES } from './constants.js'

/**
 * Замены по официальным правилам FIVB 2025–2028.
 *
 * Слот — стартовая зона игрока, то есть его позиция в расстановке: именно на неё
 * стартовый возвращается. Ротация слоты не двигает, она меняет зону, в которой
 * слот стоит.
 *
 * Лимит и пары считаются в пределах партии, поэтому состояние заводится заново
 * на каждую партию.
 */

/**
 * @typedef {object} SubstitutionSlot
 * @property {string} starterId
 * @property {string | null} substituteId — запасной пары, фиксируется при первой замене слота
 * @property {'starter' | 'substitute'} onCourt
 * @property {boolean} starterReentered — стартовый уже возвращался, пара исчерпана
 */

/**
 * @typedef {object} Substitutions
 * @property {number} used — израсходовано замен в партии
 * @property {Record<number, SubstitutionSlot>} slots
 */

/**
 * @typedef {object} SubstitutionRefusal
 * @property {string} code — для логики интерфейса
 * @property {string} message — готовый текст для показа тренеру
 */

/**
 * Открывает счёт замен для новой партии: на площадке стартовая шестёрка,
 * лимит не тронут.
 *
 * @param {import('./lineup.js').Lineup} lineup
 * @returns {Substitutions}
 */
export function initSubstitutions(lineup) {
  const slots = {}
  for (const zone of ZONES) {
    slots[zone] = {
      starterId: lineup.zones[zone].playerId,
      substituteId: null,
      onCourt: 'starter',
      starterReentered: false,
    }
  }

  return { used: 0, slots }
}

/** @param {Substitutions} state */
export function substitutionsLeft(state) {
  return MATCH_RULES.SUBSTITUTIONS_PER_SET - state.used
}

/**
 * Делает замену. Нелегальную замену совершить нельзя: вместо нового состояния
 * возвращается отказ с причиной.
 *
 * Пара «стартовый — запасной» фиксируется при первой замене слота. Пока запасной
 * на площадке, войти может только его стартовый; после возвращения стартового
 * пара исчерпана — третий игрок в неё не встаёт.
 *
 * @param {Substitutions} state
 * @param {{ outgoingId: string, incomingId: string }} request
 * @returns {{ ok: true, state: Substitutions } | { ok: false, reason: SubstitutionRefusal }}
 */
export function substitute(state, { outgoingId, incomingId }) {
  if (substitutionsLeft(state) === 0) {
    return refuse(
      'SUBSTITUTION_LIMIT_REACHED',
      `Лимит замен в партии исчерпан (${MATCH_RULES.SUBSTITUTIONS_PER_SET})`,
    )
  }

  const slotNumber = slotOf(state, outgoingId)
  if (slotNumber === null) {
    return refuse('PLAYER_NOT_ON_COURT', 'Уходящий игрок не на площадке')
  }

  if (isOnCourt(state, incomingId)) {
    return refuse('PLAYER_ALREADY_ON_COURT', 'Входящий игрок уже на площадке')
  }

  const slot = state.slots[slotNumber]

  if (slot.onCourt === 'substitute' && incomingId !== slot.starterId) {
    return refuse('ONLY_STARTER_RETURNS', 'На эту позицию может вернуться только стартовый игрок')
  }

  if (slot.starterReentered) {
    return refuse('PAIR_EXHAUSTED', 'Стартовый уже возвращался на площадку — пара исчерпана')
  }

  return { ok: true, state: apply(state, slotNumber, incomingId) }
}

/** @param {Substitutions} state */
function slotOf(state, playerId) {
  return ZONES.find((zone) => onCourtId(state.slots[zone]) === playerId) ?? null
}

/** @param {Substitutions} state */
function isOnCourt(state, playerId) {
  return slotOf(state, playerId) !== null
}

function onCourtId(slot) {
  return slot.onCourt === 'substitute' ? slot.substituteId : slot.starterId
}

function apply(state, slotNumber, incomingId) {
  const slot = state.slots[slotNumber]
  const returning = slot.onCourt === 'substitute'

  const nextSlot = returning
    ? { ...slot, onCourt: 'starter', starterReentered: true }
    : { ...slot, substituteId: incomingId, onCourt: 'substitute' }

  return { used: state.used + 1, slots: { ...state.slots, [slotNumber]: nextSlot } }
}

function refuse(code, message) {
  return { ok: false, reason: { code, message } }
}
