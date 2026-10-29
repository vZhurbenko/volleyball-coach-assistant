import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  buildPdfFilename,
  chooseCanvasScale,
  createPdfSource,
  generateSummaryPdf,
  pdfOptions,
  pdfPageFormat,
  savePdf,
} from '../pdf.js'

/** Корень итогового экрана с тем же содержимым, что и в SummaryView. */
function summaryFixture() {
  const section = document.createElement('section')
  section.className = 'screen summary'
  section.innerHTML = `
    <h1>Итоги матча</h1>
    <div class="summary__actions no-print">
      <button data-action="pdf">Скачать PDF</button>
    </div>
    <div class="point-log__scroll" style="max-height: 200px; overflow-y: auto">
      <table>
        <tbody>
          <tr><td>1</td></tr>
        </tbody>
      </table>
    </div>
  `
  document.body.append(section)
  return section
}

function stubNavigator(name, value) {
  Object.defineProperty(navigator, name, { configurable: true, value })
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
  delete navigator.canShare
  delete navigator.share
})

describe('buildPdfFilename', () => {
  it('uses the local date with zero padding', () => {
    expect(buildPdfFilename(new Date(2026, 9, 29))).toBe('match-summary-2026-10-29.pdf')
    expect(buildPdfFilename(new Date(2026, 0, 5))).toBe('match-summary-2026-01-05.pdf')
  })
})

describe('chooseCanvasScale', () => {
  it('renders the desktop at double scale', () => {
    expect(chooseCanvasScale({ width: 960, height: 6000, isIos: false })).toBe(2)
  })

  it('keeps the preferred scale on a short iOS page', () => {
    expect(chooseCanvasScale({ width: 960, height: 1000, isIos: true })).toBe(1.5)
  })

  it('lowers the scale on a long iOS page to fit the canvas limit', () => {
    const scale = chooseCanvasScale({ width: 960, height: 10000, isIos: true })

    expect(scale).toBeCloseTo(Math.sqrt(12_000_000 / (960 * 10000)))
    expect(scale).toBeLessThan(1.5)
  })

  it('never goes below one', () => {
    expect(chooseCanvasScale({ width: 960, height: 40000, isIos: true })).toBe(1)
  })
})

describe('pdfPageFormat', () => {
  it('makes one tall page with the same proportions as the summary', () => {
    const [width, height] = pdfPageFormat({ width: 960, height: 8000 })

    expect(width).toBe(210)
    expect(height).toBeCloseTo((190 * 8000) / 960 + 30)
  })
})

describe('pdfOptions', () => {
  it('fits the whole summary on one page when asked', () => {
    const options = pdfOptions({ filename: 'match.pdf', height: 8000, width: 960, singlePage: true })

    expect(options.jsPDF.format).toEqual(pdfPageFormat({ width: 960, height: 8000 }))
    expect(options.pagebreak).toBeUndefined()
  })

  it('keeps A4 pages by default', () => {
    const options = pdfOptions({ filename: 'match.pdf', height: 8000 })

    expect(options.jsPDF.format).toBe('a4')
    expect(options.pagebreak.mode).toEqual(['css', 'legacy'])
  })
})

describe('createPdfSource', () => {
  it('clones the summary without controls and expands the point logs', () => {
    const source = createPdfSource(summaryFixture())

    expect(source.clone.querySelector('.no-print')).toBeNull()
    expect(source.clone.querySelector('h1').textContent).toBe('Итоги матча')
    expect(source.clone.querySelector('.point-log__scroll').style.maxHeight).toBe('none')
    expect(source.clone.querySelector('.point-log__scroll').style.overflow).toBe('visible')

    source.remove()
  })

  it('attaches the source offscreen and removes it on demand', () => {
    const source = createPdfSource(summaryFixture(), 960)

    expect(source.element.isConnected).toBe(true)
    expect(source.element.style.width).toBe('960px')
    expect(source.element.style.left).toBe('-10000px')

    source.remove()
    expect(source.element.isConnected).toBe(false)
  })
})

describe('generateSummaryPdf', () => {
  it('rejects when there is no summary element', async () => {
    await expect(generateSummaryPdf(null)).rejects.toThrow('summary element')
  })

  it('renders the live summary at a fixed width without controls', async () => {
    const blob = new Blob(['pdf'], { type: 'application/pdf' })
    const render = vi.fn().mockImplementation(() => {
      expect(document.querySelector('[data-pdf-source]')).toBeNull()
      return Promise.resolve(blob)
    })
    const section = summaryFixture()

    await expect(
      generateSummaryPdf(section, { filename: 'match.pdf', isIos: false, render }),
    ).resolves.toBe(blob)

    const [element, options] = render.mock.calls[0]
    expect(element).toBe(section)
    expect(options.filename).toBe('match.pdf')
    expect(options.jsPDF.orientation).toBe('portrait')
    expect(options.html2canvas.windowWidth).toBe(960)
    expect(
      options.html2canvas.ignoreElements({ classList: { contains: (name) => name === 'no-print' } }),
    ).toBe(true)
    expect(
      options.html2canvas.ignoreElements({ classList: { contains: () => false } }),
    ).toBe(false)
  })

  it('expands the point logs inside the rendered copy', async () => {
    const render = vi.fn().mockResolvedValue(new Blob())
    await generateSummaryPdf(summaryFixture(), { render })

    const clonedDoc = document.implementation.createHTMLDocument('clone')
    render.mock.calls[0][1].html2canvas.onclone(clonedDoc)

    expect(clonedDoc.head.textContent).toContain('.point-log__scroll')
    expect(clonedDoc.head.textContent).toContain('max-height: none')
    expect(clonedDoc.head.textContent).toContain('.stats-table')
    expect(clonedDoc.head.textContent).toContain('min-width: 0')
  })

  it('starts the rendered copy at the left edge of the table', async () => {
    const render = vi.fn().mockResolvedValue(new Blob())
    await generateSummaryPdf(summaryFixture(), { render })

    const clonedDoc = document.implementation.createHTMLDocument('clone')
    const wrap = clonedDoc.createElement('div')
    wrap.className = 'table-wrap'
    Object.defineProperty(wrap, 'scrollLeft', { value: 300, writable: true, configurable: true })
    Object.defineProperty(wrap, 'scrollTop', { value: 200, writable: true, configurable: true })
    clonedDoc.body.append(wrap)

    render.mock.calls[0][1].html2canvas.onclone(clonedDoc)

    expect(wrap.scrollLeft).toBe(0)
    expect(wrap.scrollTop).toBe(0)
  })

  it('resets the live scroll while rendering and restores it afterwards', async () => {
    const section = summaryFixture()
    const scroller = section.querySelector('.point-log__scroll')
    Object.defineProperty(scroller, 'scrollTop', { value: 100, writable: true, configurable: true })
    const render = vi.fn().mockImplementation((element) => {
      expect(element.querySelector('.point-log__scroll').scrollTop).toBe(0)
      return Promise.resolve(new Blob())
    })

    await generateSummaryPdf(section, { render })

    expect(scroller.scrollTop).toBe(100)
  })

  it('removes the measuring copy when rendering fails', async () => {
    const render = vi.fn().mockRejectedValue(new Error('boom'))

    await expect(generateSummaryPdf(summaryFixture(), { render })).rejects.toThrow('boom')

    expect(document.querySelector('[data-pdf-source]')).toBeNull()
  })

  it('builds a dated filename by default', async () => {
    const render = vi.fn().mockResolvedValue(new Blob())

    await generateSummaryPdf(summaryFixture(), { render })

    expect(render.mock.calls[0][1].filename).toMatch(/^match-summary-\d{4}-\d{2}-\d{2}\.pdf$/)
  })
})

describe('savePdf', () => {
  let click
  let clicked

  beforeEach(() => {
    URL.createObjectURL = vi.fn(() => 'blob:pdf')
    URL.revokeObjectURL = vi.fn()
    clicked = null
    click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicked = { download: this.download, href: this.href }
    })
  })

  it('downloads the file outside iOS', async () => {
    const result = await savePdf(new Blob(['pdf']), 'match.pdf', { isIos: false })

    expect(result).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
    expect(clicked).toEqual({ download: 'match.pdf', href: 'blob:pdf' })
    expect(document.querySelector('a[download]')).toBeNull()
  })

  it('opens the iOS share sheet when the browser can share files', async () => {
    const share = vi.fn().mockResolvedValue()
    stubNavigator('canShare', vi.fn(() => true))
    stubNavigator('share', share)

    const result = await savePdf(new Blob(['pdf']), 'match.pdf', { isIos: true })

    expect(result).toBe('shared')
    expect(share).toHaveBeenCalledWith({
      files: [expect.any(File)],
      title: 'Итоги матча',
    })
    expect(share.mock.calls[0][0].files[0].name).toBe('match.pdf')
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to downloading when iOS cannot share files', async () => {
    stubNavigator('canShare', vi.fn(() => false))

    const result = await savePdf(new Blob(['pdf']), 'match.pdf', { isIos: true })

    expect(result).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })

  it('keeps quiet when the user cancels sharing', async () => {
    stubNavigator('canShare', vi.fn(() => true))
    stubNavigator(
      'share',
      vi.fn().mockRejectedValue(Object.assign(new Error('cancelled'), { name: 'AbortError' })),
    )

    const result = await savePdf(new Blob(['pdf']), 'match.pdf', { isIos: true })

    expect(result).toBe('cancelled')
    expect(click).not.toHaveBeenCalled()
  })

  it('falls back to downloading when sharing fails', async () => {
    stubNavigator('canShare', vi.fn(() => true))
    stubNavigator('share', vi.fn().mockRejectedValue(new Error('nope')))

    const result = await savePdf(new Blob(['pdf']), 'match.pdf', { isIos: true })

    expect(result).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
  })
})
