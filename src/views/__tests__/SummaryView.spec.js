import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cwd } from 'node:process'

import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'

import { defaultLineup } from '../../domain/lineup.js'
import { EVENT_TYPES } from '../../domain/match.js'
import { TEAM_ROSTER } from '../../domain/__tests__/fixtures/team-roster.js'
import { TEAMS } from '../../domain/score.js'
import { STAT_TYPES } from '../../domain/stats.js'
import { buildPdfFilename, generateSummaryPdf, savePdf } from '../../pdf.js'
import { loadMatch, saveMatch, saveRosterSettings } from '../../storage.js'
import SummaryView from '../SummaryView.vue'

vi.mock('../../pdf.js', () => ({
  buildPdfFilename: vi.fn(),
  generateSummaryPdf: vi.fn(),
  savePdf: vi.fn(),
}))

const LINEUP = defaultLineup(TEAM_ROSTER)

const point = (team) => ({ type: EVENT_TYPES.POINT, team })
const setStart = (serving) => ({ type: EVENT_TYPES.SET_START, lineup: LINEUP, serving })
const stat = (playerId, statType) => ({ type: EVENT_TYPES.STAT, playerId, statType })

/** Партия с заданным счётом; очки чередуются, чтобы партия не закрылась раньше времени. */
function playedSet({ serving, us, them, stats = [], prefix = [] }) {
  const events = [setStart(serving), ...prefix, ...stats]
  let u = 0
  let t = 0

  while (u < us || t < them) {
    if (u < us) {
      events.push(point(TEAMS.US))
      u += 1
    }
    if (t < them) {
      events.push(point(TEAMS.THEM))
      t += 1
    }
  }

  return events
}

function finishedMatch() {
  return [
    ...playedSet({
      serving: TEAMS.US,
      us: 25,
      them: 10,
      stats: [stat('titov', STAT_TYPES.POINT), stat('gromov', STAT_TYPES.BLOCK)],
    }),
    ...playedSet({
      serving: TEAMS.THEM,
      us: 20,
      them: 25,
      stats: [stat('titov', STAT_TYPES.SERVE)],
    }),
    ...playedSet({ serving: TEAMS.US, us: 25, them: 15 }),
    ...playedSet({ serving: TEAMS.THEM, us: 25, them: 20 }),
  ]
}

/** Хранилище в памяти — та же поверхность, что у localStorage. */
function fakeStorage() {
  const items = new Map()
  return {
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => items.set(key, String(value)),
    removeItem: (key) => items.delete(key),
  }
}

function saveFinished(storage, events = finishedMatch()) {
  saveMatch(
    {
      events,
      settings: {
        teamName: 'Наши',
        opponent: 'Динамо',
        lineup: LINEUP,
        serving: TEAMS.US,
        substitutionMode: 'count',
      },
    },
    storage,
  )
}

function testRouter() {
  return createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: 'lineup', component: { template: '<div />' } },
      { path: '/summary', name: 'summary', component: { template: '<div />' } },
    ],
  })
}

async function mountView() {
  const pinia = createPinia()
  setActivePinia(pinia)
  const router = testRouter()
  await router.push('/summary')
  await router.isReady()

  const wrapper = mount(SummaryView, {
    props: { storage },
    global: { plugins: [pinia, router] },
  })

  return { wrapper, router }
}

let storage

beforeEach(() => {
  vi.clearAllMocks()
  vi.mocked(buildPdfFilename).mockReturnValue('match-summary-2026-10-29.pdf')
  vi.mocked(generateSummaryPdf).mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }))
  vi.mocked(savePdf).mockResolvedValue('downloaded')

  storage = fakeStorage()
  saveRosterSettings({ players: TEAM_ROSTER, defaultLineup: LINEUP }, storage)
  saveFinished(storage)
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SummaryView', () => {
  it('renders the match result and the set scores', async () => {
    const { wrapper } = await mountView()

    const result = wrapper.get('[data-field="match-result"]')
    expect(result.text()).toContain('Наши')
    expect(result.text()).toContain('Динамо')
    expect(result.text()).toContain('3:1')

    expect(wrapper.get('[data-set="1"]').text()).toContain('25:10')
    expect(wrapper.get('[data-set="2"]').text()).toContain('20:25')
    expect(wrapper.get('[data-set="4"]').text()).toContain('25:20')
  })

  it('renders the stats by set and for the whole match', async () => {
    const { wrapper } = await mountView()

    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat="point"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="gromov"] [data-stat="block"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="2"] [data-stat-player="titov"] [data-stat="serve"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat="serve"]').text(),
    ).toBe('0')

    expect(wrapper.get('[data-total-player="titov"] [data-stat="point"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="titov"] [data-stat="serve"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="gromov"] [data-stat="block"]').text()).toBe('1')
    expect(wrapper.get('[data-total-player="zhurbenko"] [data-stat="point"]').text()).toBe('0')
  })

  it('adds the points and errors totals to every table', async () => {
    const { wrapper } = await mountView()

    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat-total="points"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat-total="errors"]').text(),
    ).toBe('0')
    expect(
      wrapper.get('[data-total-player="titov"] [data-stat-total="points"]').text(),
    ).toBe('2')
    expect(
      wrapper.get('[data-total-player="titov"] [data-stat-total="errors"]').text(),
    ).toBe('0')
  })

  it('renders the stats as a table with the two totals columns', async () => {
    const { wrapper } = await mountView()

    const headers = wrapper
      .get('[data-field="total-stats"] thead tr')
      .findAll('th')
      .map((cell) => cell.text())

    expect(headers).toEqual([
      'Игрок',
      'очко',
      'подача',
      'блок',
      'ошибка',
      'ошибка в приёме',
      'ошибка на подаче',
      'Итого ошибок',
      'Итого очков',
    ])
    expect(wrapper.get('[data-field="total-stats"] table').classes()).toContain('stats-table')
    expect(wrapper.get('[data-field="total-stats"] .table-wrap').exists()).toBe(true)
  })

  it('counts the reception error by set and for the match', async () => {
    saveFinished(storage, [
      ...playedSet({
        serving: TEAMS.US,
        us: 25,
        them: 10,
        stats: [stat('titov', STAT_TYPES.RECEPTION_ERROR)],
      }),
      ...playedSet({ serving: TEAMS.THEM, us: 20, them: 25 }),
      ...playedSet({ serving: TEAMS.US, us: 25, them: 15 }),
      ...playedSet({ serving: TEAMS.THEM, us: 25, them: 20 }),
    ])

    const { wrapper } = await mountView()

    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat="reception_error"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-total-player="titov"] [data-stat="reception_error"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-set="1"] [data-stat-player="titov"] [data-stat-total="errors"]').text(),
    ).toBe('1')
    expect(
      wrapper.get('[data-total-player="titov"] [data-stat-total="errors"]').text(),
    ).toBe('1')
  })

  it('renders the point log for every set', async () => {
    const { wrapper } = await mountView()

    const logs = wrapper.findAll('[data-field="point-log"]')
    expect(logs).toHaveLength(4)
    expect(logs[0].text()).toContain('Наши')
    expect(logs[0].text()).toContain('Динамо')

    // Мы всегда слева, даже если партию выиграл соперник.
    expect(logs[1].text().indexOf('Наши')).toBeLessThan(logs[1].text().indexOf('Динамо'))
  })

  it('keeps the exceptional substitution in the set card only', async () => {
    saveFinished(storage, [
      ...playedSet({
        serving: TEAMS.US,
        us: 25,
        them: 10,
        prefix: [
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'titov',
            incomingId: 'gorobchenko',
          },
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'gorobchenko',
            incomingId: 'emelyanov',
            exceptional: true,
          },
        ],
      }),
      ...playedSet({ serving: TEAMS.THEM, us: 20, them: 25 }),
      ...playedSet({ serving: TEAMS.US, us: 25, them: 15 }),
      ...playedSet({ serving: TEAMS.THEM, us: 25, them: 20 }),
    ])

    const { wrapper } = await mountView()

    const substitutions = wrapper.get('[data-set="1"] [data-field="set-substitutions"]')
    expect(substitutions.text()).toContain('Горобченко')
    expect(substitutions.text()).toContain('Емельянов')
    expect(substitutions.text()).toContain('исключительная')

    expect(wrapper.find('[data-field="substitutions"]').exists()).toBe(false)
    expect(wrapper.find('[data-field="retired"]').exists()).toBe(false)
    expect(wrapper.find('[data-field="exceptional-substitutions"]').exists()).toBe(false)
  })

  it('lists the substitutions of every set after the point log', async () => {
    saveFinished(storage, [
      ...playedSet({
        serving: TEAMS.US,
        us: 25,
        them: 10,
        prefix: [
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'titov',
            incomingId: 'gorobchenko',
          },
          {
            type: EVENT_TYPES.SUBSTITUTION,
            outgoingId: 'gorobchenko',
            incomingId: 'emelyanov',
            exceptional: true,
          },
        ],
      }),
      ...playedSet({ serving: TEAMS.THEM, us: 20, them: 25 }),
    ])

    const { wrapper } = await mountView()

    const set = wrapper.get('[data-set="1"]')
    const substitutions = set.get('[data-field="set-substitutions"]')
    expect(substitutions.text()).toContain('Титов')
    expect(substitutions.text()).toContain('Горобченко')
    expect(substitutions.text()).toContain('Емельянов')
    expect(substitutions.text()).toContain('исключительная')
    expect(substitutions.findAll('li')).toHaveLength(2)

    const pointLog = set.get('[data-field="point-log"]').element
    expect(
      pointLog.compareDocumentPosition(substitutions.element) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(wrapper.find('[data-set="2"] [data-field="set-substitutions"]').exists()).toBe(false)
  })

  it('has print styles', () => {
    const css = readFileSync(resolve(cwd(), 'src/assets/main.css'), 'utf8')

    expect(css).toContain('@media print')
    expect(css).toContain('.no-print')
  })

  it('offers a PDF download for the whole summary', async () => {
    const { wrapper } = await mountView()

    const button = wrapper.get('[data-action="pdf"]')
    expect(button.text()).toBe('Скачать PDF')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('generates the PDF from the summary screen and saves it', async () => {
    const { wrapper } = await mountView()

    await wrapper.get('[data-action="pdf"]').trigger('click')
    await flushPromises()

    expect(generateSummaryPdf).toHaveBeenCalledTimes(1)
    const [element, options] = generateSummaryPdf.mock.calls[0]
    expect(element).toBe(wrapper.get('[data-field="pdf-summary"]').element)
    expect(options).toEqual({ filename: 'match-summary-2026-10-29.pdf', singlePage: true })
    expect(savePdf).toHaveBeenCalledWith(expect.any(Blob), 'match-summary-2026-10-29.pdf')
  })

  it('disables the PDF button while generating and ignores repeated clicks', async () => {
    let finish
    vi.mocked(generateSummaryPdf).mockReturnValue(
      new Promise((resolve) => {
        finish = resolve
      }),
    )
    const { wrapper } = await mountView()
    const button = wrapper.get('[data-action="pdf"]')

    await button.trigger('click')

    expect(button.attributes('disabled')).toBeDefined()
    expect(button.text()).toBe('Генерация…')

    await button.trigger('click')
    expect(generateSummaryPdf).toHaveBeenCalledTimes(1)

    finish(new Blob(['pdf'], { type: 'application/pdf' }))
    await flushPromises()

    expect(button.attributes('disabled')).toBeUndefined()
    expect(button.text()).toBe('Скачать PDF')
  })

  it('reports a PDF generation error', async () => {
    vi.mocked(generateSummaryPdf).mockRejectedValue(new Error('boom'))
    const { wrapper } = await mountView()
    const button = wrapper.get('[data-action="pdf"]')

    await button.trigger('click')
    await flushPromises()

    expect(wrapper.get('[data-field="export-status"]').text()).toBe('Не удалось создать PDF')
    expect(button.attributes('disabled')).toBeUndefined()
  })

  it('does not report a cancelled share as an error', async () => {
    vi.mocked(savePdf).mockRejectedValue(
      Object.assign(new Error('cancelled'), { name: 'AbortError' }),
    )
    const { wrapper } = await mountView()

    await wrapper.get('[data-action="pdf"]').trigger('click')
    await flushPromises()

    expect(wrapper.find('[data-field="export-status"]').exists()).toBe(false)
  })

  it('starts a new game and returns to the lineup', async () => {
    const { wrapper, router } = await mountView()

    await wrapper.get('[data-action="new-game"]').trigger('click')
    await flushPromises()

    expect(router.currentRoute.value.name).toBe('lineup')
    expect(loadMatch(storage)).toBeNull()
  })

  it('uses the roster from storage in the totals', async () => {
    const players = TEAM_ROSTER.map((player) =>
      player.id === 'titov' ? { ...player, lastName: 'Титов-младший' } : player,
    )
    saveRosterSettings({ players, defaultLineup: LINEUP }, storage)

    const { wrapper } = await mountView()

    expect(wrapper.get('[data-total-player="titov"]').text()).toContain('Титов-младший')
  })

  it('offers only the PDF download', async () => {
    const { wrapper } = await mountView()

    expect(wrapper.find('[data-action="pdf"]').exists()).toBe(true)
    expect(wrapper.find('[data-action="print"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="share"]').exists()).toBe(false)
    expect(wrapper.find('[data-action="copy"]').exists()).toBe(false)
  })

  it('freezes the player column while the stats scroll on a phone', () => {
    const source = readFileSync(resolve(cwd(), 'src/views/SummaryView.vue'), 'utf8')

    expect(source).toContain('position: sticky')
    expect(source).toContain('left: 0')
  })
})
