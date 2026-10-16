import { ROLES, ZONES } from './constants.js'
import { zoneOfSlot } from './rotation.js'

/**
 * Координаты игрового режима (приём) — сняты с референса Volley51,
 * источник и допущения описаны в docs/formations.md.
 *
 * Наша ориентация: x — слева направо с нашей стороны, y — от сетки (0)
 * к лицевой линии (100). Показана только наша половина площадки.
 *
 * Ключ таблицы — расстановка, то есть номер зоны связки, как принято в схеме 5-1:
 * расстановка 1 — связка в зоне 1. Значения внутри — позиция игрока, стоящего
 * в этой зоне на приёме; либеро указан в зоне заменённого им ЦБ.
 */
export const FORMATIONS = {
  1: {
    1: { x: 83, y: 83 },
    2: { x: 73, y: 73 },
    3: { x: 17, y: 6 },
    4: { x: 6, y: 27 },
    5: { x: 27, y: 73 },
    6: { x: 50, y: 73 },
  },
  2: {
    1: { x: 73, y: 73 },
    2: { x: 73, y: 6 },
    3: { x: 27, y: 67 },
    4: { x: 6, y: 27 },
    5: { x: 27, y: 94 },
    6: { x: 50, y: 73 },
  },
  3: {
    1: { x: 73, y: 73 },
    2: { x: 94, y: 17 },
    3: { x: 73, y: 6 },
    4: { x: 27, y: 67 },
    5: { x: 50, y: 73 },
    6: { x: 61, y: 94 },
  },
  4: {
    1: { x: 94, y: 94 },
    2: { x: 27, y: 67 },
    3: { x: 17, y: 17 },
    4: { x: 6, y: 6 },
    5: { x: 50, y: 73 },
    6: { x: 73, y: 73 },
  },
  5: {
    1: { x: 73, y: 73 },
    2: { x: 94, y: 27 },
    3: { x: 27, y: 67 },
    4: { x: 6, y: 17 },
    5: { x: 17, y: 27 },
    6: { x: 50, y: 73 },
  },
  6: {
    1: { x: 73, y: 73 },
    2: { x: 94, y: 27 },
    3: { x: 61, y: 6 },
    4: { x: 27, y: 67 },
    5: { x: 50, y: 73 },
    6: { x: 61, y: 17 },
  },
}

/**
 * Расстановка, в которой идёт партия: номер зоны, где стоит связка.
 * Если связки в шестёрке нет, расстановку не определить — это не 5-1.
 *
 * @param {object} params
 * @param {import('./lineup.js').Lineup} params.lineup
 * @param {number} params.rotations
 * @returns {number | null}
 */
export function setterZone({ lineup, rotations }) {
  const slot = ZONES.find((zone) => lineup.zones[zone]?.role === ROLES.SETTER)
  return slot ? zoneOfSlot(slot, rotations) : null
}

/**
 * Координаты приёма для текущего состояния: зона → { x, y }.
 *
 * @param {object} params
 * @param {import('./lineup.js').Lineup} params.lineup
 * @param {number} params.rotations
 * @returns {Record<number, { x: number, y: number }> | null}
 */
export function receivingPositions({ lineup, rotations }) {
  const rotation = setterZone({ lineup, rotations })
  return rotation === null ? null : FORMATIONS[rotation]
}
