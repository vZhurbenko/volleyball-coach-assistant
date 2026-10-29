import { describe, expect, it } from 'vitest'

import { buildSummaryText } from '../summary.js'

const ROSTER = [
  { id: 'belov', firstName: 'Иван', lastName: 'Белов', number: 1, role: 'outside_hitter' },
  { id: 'morozov', firstName: 'Пётр', lastName: 'Морозов', number: 7, role: 'setter' },
  { id: 'sokolov', firstName: 'Алексей', lastName: 'Соколов', number: 3, role: 'middle_blocker' },
]

const SETTINGS = { teamName: 'Наши', opponent: 'Динамо' }

function counters(overrides = {}) {
  return { point: 0, serve: 0, block: 0, error: 0, reception_error: 0, serve_error: 0, ...overrides }
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
        '# Наши — Динамо',
        '',
        '**Счёт: 3:1**',
        '',
        '## Партия 1: 25:10',
        '',
        '| Игрок | очко | подача | блок | ошибка | ошибка в приёме | ошибка на подаче |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| №1 Белов | 1 | 0 | 0 | 0 | 0 | 0 |',
        '',
        '## Партия 2: 20:25',
        '',
        '| Игрок | очко | подача | блок | ошибка | ошибка в приёме | ошибка на подаче |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| №7 Морозов | 0 | 1 | 0 | 0 | 0 | 0 |',
        '',
        '## Партия 3: 25:15',
        '',
        '_Статистика не велась_',
        '',
        '## Партия 4: 25:20',
        '',
        '_Статистика не велась_',
        '',
        '## За матч',
        '',
        '| Игрок | очко | подача | блок | ошибка | ошибка в приёме | ошибка на подаче |',
        '| --- | ---: | ---: | ---: | ---: | ---: | ---: |',
        '| №1 Белов | 1 | 0 | 0 | 0 | 0 | 0 |',
        '| №7 Морозов | 0 | 1 | 0 | 0 | 0 | 0 |',
      ].join('\n'),
    )
  })

  it('puts the reception error into its own Markdown column', () => {
    const state = stateFixture({
      stats: { sets: [{ belov: counters({ reception_error: 1 }) }] },
      score: { sets: [{ number: 1, points: { us: 25, them: 10 } }], serving: 'us' },
    })

    const text = buildSummaryText({ state, settings: SETTINGS, roster: ROSTER })

    expect(text).toContain('| №1 Белов | 0 | 0 | 0 | 0 | 1 | 0 |')
  })

  it('lists exceptional substitutions and retired players', () => {
    const state = stateFixture({
      substitutions: {
        retired: ['sokolov'],
        exceptional: [{ outgoingId: 'sokolov', incomingId: 'belov' }],
      },
    })

    const text = buildSummaryText({ state, settings: SETTINGS, roster: ROSTER })

    expect(text).toContain('## Замены')
    expect(text).toContain('- Исключительные: Алексей Соколов → Иван Белов (выбыл: Алексей Соколов)')
    expect(text).toContain('- Выбывшие: Алексей Соколов')
  })

  it('says the stats were not kept when there are no facts', () => {
    const state = stateFixture({
      stats: { sets: [] },
      score: { sets: [{ number: 1, points: { us: 25, them: 10 } }], serving: 'us' },
    })

    const text = buildSummaryText({ state, settings: SETTINGS, roster: ROSTER })

    expect(text).toContain('## Партия 1: 25:10\n\n_Статистика не велась_')
    expect(text).toContain('## За матч\n\n_Статистика не велась_')
  })

  it('falls back to default team names', () => {
    const text = buildSummaryText({ state: stateFixture(), settings: {}, roster: ROSTER })

    expect(text).toContain('# Мы — Соперник')
  })
})
