import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { defaultLineup, validateLineup } from '../domain/lineup.js'
import { TEAM_ROSTER } from '../domain/players.js'

/**
 * Стартовая расстановка, общая для экранов расстановки и настройки игры.
 *
 * Предзаполняется дефолтной шестёркой; тренер может перебить любую зону.
 * Валидация берётся из ядра, чтобы тексты нарушений не дублировались в UI.
 */
export const useLineupStore = defineStore('lineup', () => {
  const roster = ref(TEAM_ROSTER)
  const lineup = ref(defaultLineup(roster.value))
  const validation = computed(() => validateLineup(lineup.value, roster.value))

  /**
   * Задаёт состав команды и заново собирает дефолтную шестёрку.
   * Нужен тестам, которые подменяют состав, например добавляют либеро.
   *
   * @param {import('../domain/players.js').Player[]} teamRoster
   */
  function init(teamRoster) {
    roster.value = teamRoster
    lineup.value = defaultLineup(teamRoster)
  }

  /**
   * @param {number} zone
   * @param {{ playerId: string, role: string }} assignment
   */
  function assign(zone, { playerId, role }) {
    lineup.value = {
      ...lineup.value,
      zones: { ...lineup.value.zones, [zone]: { playerId, role } },
    }
  }

  /** @param {string | null} liberoId */
  function setLibero(liberoId) {
    lineup.value = { ...lineup.value, liberoId }
  }

  function reset() {
    lineup.value = defaultLineup(roster.value)
  }

  return { roster, lineup, validation, init, assign, setLibero, reset }
})
