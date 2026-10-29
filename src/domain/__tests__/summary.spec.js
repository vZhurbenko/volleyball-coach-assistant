import { describe, expect, it } from 'vitest'

import { buildSummaryText } from '../summary.js'

const ROSTER = [
  { id: 'belov', firstName: 'Иван', lastName: 'Белов', number: 1, role: 'outside_hitter' },
  { id: 'morozov', firstName: 'Пётр', lastName: 'Морозов', number: 7, role: 'setter' },
  { id: 'sokolov', firstName: 'Алексей', lastName: 'Соколов', number: 3, role: 'middle_blocker' },
]

const SETTINGS = { teamName: 'Наши', opponent: 'Динамо' }

function counters(overrides = {}) {
  return { point: 0, serve: 0, serve_error: 0, error: 0, block: 0, ...overrides }
}

function stateFixture(overrides = {}) {
  return {
    score: {
      sets: [
        { number: 1, points: { us: 25, them: 10 } },
        { number: 2, points: { us: 20, them: 25 } },
        { number: 3, points: { us: 25, them: 15 } },
        { number: 4, points: { us: 25, them: 20 } },
      ],
      serving: 'us',
    },
    stats: {
      sets: [{ belov: counters({ point: 1 }) }, { morozov: counters({ serve: 1 }) }, {}, {}],
    },
    substitutions: { retired: [], exceptional: [] },
    ...overrides,
  }
}

describe('buildSummaryText', () => {
  it('renders the result, set scores and per-set stats', () => {
    const text = buildSummaryText({ state: stateFixture(), settings: SETTINGS, roster: ROSTER })

    expect(text).toBe(
      [
        'Наши — Динамо',
        'Счёт: 3:1',
        '',
        'Партия 1: 25:10',
        '№1 Белов: +очко 1',
        '',
        'Партия 2: 20:25',
        '№7 Морозов: +подача 1',
        '',
        'Партия 3: 25:15',
        'Статистика не велась',
        '',
        'Партия 4: 25:20',
        'Статистика не велась',
        '',
        'За матч',
        '№1 Белов: +очко 1',
        '№7 Морозов: +подача 1',
      ].join('\n'),
    )
  })

  it('lists exceptional substitutions and retired players', () => {
    const state = stateFixture({
      substitutions: {
        retired: ['sokolov'],
        exceptional: [{ outgoingId: 'sokolov', incomingId: 'belov' }],
      },
    })

    const text = buildSummaryText({ state, settings: SETTINGS, roster: ROSTER })

    expect(text).toContain('Исключительные замены')
    expect(text).toContain('Алексей Соколов → Иван Белов (выбыл: Алексей Соколов)')
    expect(text).toContain('Выбывшие: Алексей Соколов')
  })

  it('says the stats were not kept when there are no facts', () => {
    const state = stateFixture({
      stats: { sets: [] },
      score: { sets: [{ number: 1, points: { us: 25, them: 10 } }], serving: 'us' },
    })

    const text = buildSummaryText({ state, settings: SETTINGS, roster: ROSTER })

    expect(text).toContain('Партия 1: 25:10\nСтатистика не велась')
    expect(text).toContain('За матч\nСтатистика не велась')
  })

  it('falls back to default team names', () => {
    const text = buildSummaryText({ state: stateFixture(), settings: {}, roster: ROSTER })

    expect(text).toContain('Мы — Соперник')
  })
})
