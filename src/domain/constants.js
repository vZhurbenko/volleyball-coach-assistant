/**
 * Константы домена: роли, зоны, лимиты.
 *
 * Величины, которые заданы правилами FIVB и могут меняться от сезона к сезону,
 * собраны здесь, чтобы логику не приходилось переписывать.
 */

/** Роли игроков. */
export const ROLES = {
  MIDDLE_BLOCKER: 'middle_blocker',
  OUTSIDE_HITTER: 'outside_hitter',
  SETTER: 'setter',
  OPPOSITE: 'opposite',
  LIBERO: 'libero',
}

/** Роли, которые можно поставить в шестёрку: либеро выбирается отдельно. */
export const COURT_ROLES = [
  ROLES.MIDDLE_BLOCKER,
  ROLES.OUTSIDE_HITTER,
  ROLES.SETTER,
  ROLES.OPPOSITE,
]

/** Подписи ролей для интерфейса. */
export const ROLE_LABELS = {
  [ROLES.MIDDLE_BLOCKER]: 'ЦБ',
  [ROLES.OUTSIDE_HITTER]: 'Доигровщик',
  [ROLES.SETTER]: 'Связка',
  [ROLES.OPPOSITE]: 'Диагональный',
  [ROLES.LIBERO]: 'Либеро',
}

/** Зоны площадки по протоколу. */
export const ZONES = [1, 2, 3, 4, 5, 6]

export const MATCH_RULES = {
  /**
   * Лимит замен в партии на команду — официальная норма FIVB 2025–2028.
   * На 2026 год FIVB тестирует 8 замен (VNL 2026, юношеские и континентальные
   * турниры), но официальной нормой остаются 6.
   */
  SUBSTITUTIONS_PER_SET: 6,
}

/**
 * Лимиты ролей в стартовой шестёрке.
 * `maxWithOpposite` — сколько связок допустимо, когда в шестёрке есть диагональный.
 */
export const LINEUP_ROLE_LIMITS = {
  [ROLES.MIDDLE_BLOCKER]: { max: 2 },
  [ROLES.OUTSIDE_HITTER]: { max: 2 },
  [ROLES.OPPOSITE]: { max: 1 },
  [ROLES.SETTER]: { max: 2, maxWithOpposite: 1 },
}
