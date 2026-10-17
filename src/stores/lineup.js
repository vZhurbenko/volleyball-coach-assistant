import { computed, ref } from 'vue'
import { defineStore } from 'pinia'

import { defaultLineup, validateLineup } from '../domain/lineup.js'
import { MOCK_ROSTER } from '../domain/players.js'

/**
 * Стартовая расстановка, общая для экранов расстановки и настройки игры.
 *
 * Предзаполняется дефолтной шестёркой; тренер может перебить любую зону.
 * Валидация берётся из ядра, чтобы тексты нарушений не дублировались в UI.
 */
export const useLineupStore = defineStore('lineup', () => {
  const lineup = ref(defaultLineup(MOCK_ROSTER))
  const validation = computed(() => validateLineup(lineup.value, MOCK_ROSTER))

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
    lineup.value = defaultLineup(MOCK_ROSTER)
  }

  return { lineup, validation, assign, setLibero, reset }
})
