import { MATCH_RULES, ZONES } from './constants.js'

/**
 * Замены по официальным правилам FIVB 2025–2028.
 *
 * Слот — стартовая зона игрока, то есть его позиция в расстановке: именно на неё
 * стартовый возвращается. Ротация слоты не двигает, она меняет зону, в которой
 * слот стоит.
 *
 * Лимит и пары считаются в пределах партии, поэтому состояние заводится заново
 * на каждую партию. Выбывшие игроки и исключительные замены — факты матча,
 * они переживают границу партии.
 */

/**
 * @typedef {object} SubstitutionSlot
 * @property {string} starterId — хозяин позиции, он же единственный, кому она обязана вернуться
 * @property {string | null} substituteId — запасной пары, фиксируется при первой замене слота
 * @property {'starter' | 'substitute'} onCourt
 * @property {boolean} starterReentered — стартовый уже возвращался, пара исчерпана
 */

/**
 * @typedef {object} ExceptionalSubstitution
 * @property {string} outgoingId — выбывший игрок
 * @property {string} incomingId
 */

/**
 * @typedef {object} Substitutions
 * @property {number} used — израсходовано замен в партии
 * @property {Record<number, SubstitutionSlot>} slots
 * @property {string[]} retired — выбывшие до конца матча
 * @property {ExceptionalSubstitution[]} exceptional — для пометок в итогах
 */

/**
 * @typedef {object} SubstitutionRefusal
 * @property {string} code — для логики интерфейса
 * @property {string} message — готовый текст для показа тренеру
 */

/**
 * Открывает счёт замен для новой партии: на площадке стартовая шестёрка,
 * лимит не тронут. Выбывшие и исключительные замены переносятся из прошлой
 * партии — это факты матча, а не партии.
 *
 * @param {import('./lineup.js').Lineup} lineup
 * @param {Substitutions} [previousSet] — состояние прошлой партии
 * @returns {Substitutions}
 */
export function initSubstitutions(lineup, previousSet) {
  const slots = {}
  for (const zone of ZONES) {
    slots[zone] = {
      starterId: lineup.zones[zone].playerId,
      substituteId: null,
      onCourt: 'starter',
      starterReentered: false,
    }
  }

  return {
    used: 0,
    slots,
    retired: previousSet?.retired ?? [],
    exceptional: previousSet?.exceptional ?? [],
  }
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
 * @param {{ outgoingId: string, incomingId: string, exceptional?: boolean }} request
 *   `exceptional` — замена при травме, болезни или удалении: идёт сверх лимита
 *   и правил пар, а заменённый выбывает до конца матча
 * @returns {{ ok: true, state: Substitutions } | { ok: false, reason: SubstitutionRefusal }}
 */
export function substitute(state, { outgoingId, incomingId, exceptional = false }) {
  if (state.retired.includes(incomingId)) {
    return refuse('PLAYER_RETIRED', 'Игрок выбыл до конца матча')
  }

  if (!exceptional && substitutionsLeft(state) === 0) {
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

  if (exceptional) {
    return { ok: true, state: applyExceptional(state, slotNumber, outgoingId, incomingId) }
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

  return { ...state, used: state.used + 1, slots: { ...state.slots, [slotNumber]: nextSlot } }
}

/**
 * Выбывший уходит из матча, а вошедший становится хозяином позиции: дальше слот
 * живёт по обычным правилам, поэтому замена не выключает позицию до конца матча.
 * Лимит не расходуется.
 */
function applyExceptional(state, slotNumber, outgoingId, incomingId) {
  return {
    ...state,
    slots: {
      ...state.slots,
      [slotNumber]: {
        starterId: incomingId,
        substituteId: null,
        onCourt: 'starter',
        starterReentered: false,
      },
    },
    retired: [...state.retired, outgoingId],
    exceptional: [...state.exceptional, { outgoingId, incomingId }],
  }
}

function refuse(code, message) {
  return { ok: false, reason: { code, message } }
}
