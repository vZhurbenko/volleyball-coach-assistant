/**
 * PDF-выгрузка итогового экрана матча.
 *
 * html2pdf.js делает растровый снимок DOM: html2canvas рисует страницу,
 * jsPDF упаковывает её в PDF. html2pdf сам сужает контейнер до ширины
 * страницы (190 мм), поэтому с телефона не получается растянутый скриншот
 * шириной 360 px; windowWidth даёт планшетные медиазапросы, а журналы
 * партий раскрываются целиком.
 */

import { isIosDevice } from './platform.js'

/** Ширина окна при рендере: планшетные медиазапросы вместо телефонных. */
export const PDF_WIDTH = 960

const PDF_PAGE_WIDTH_MM = 210
const PDF_MARGIN_MM = 10
const PAGE_HEIGHT_BUFFER_MM = 10
const IOS_CANVAS_AREA = 12_000_000

/** html2pdf кладёт элемент в контейнер шириной 190 мм — это и есть ширина снимка. */
const PDF_RENDER_WIDTH_PX = ((PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2) / 25.4) * 96
const PDF_PADDING_PX = 24
const DESKTOP_CANVAS_AREA = 150_000_000
const MAX_CANVAS_DIMENSION = 32_000
const REVOKE_DELAY_MS = 30_000

/**
 * @param {Date} [date]
 * @returns {string}
 */
export function buildPdfFilename(date = new Date()) {
  const pad = (value) => String(value).padStart(2, '0')

  return `match-summary-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.pdf`
}

/**
 * Масштаб html2canvas с оглядкой на лимиты канваса.
 *
 * Safari на iOS не умеет канвасы больше ~16.7 млн пикселей: вместо PDF
 * получается пустой лист. Поэтому на длинном матче масштаб снижается.
 *
 * @param {{ width: number, height: number, isIos: boolean }} params
 * @returns {number}
 */
export function chooseCanvasScale({ width, height, isIos }) {
  const preferred = isIos ? 1.5 : 2
  const areaLimit = isIos ? IOS_CANVAS_AREA : DESKTOP_CANVAS_AREA
  const area = Math.max(1, width * height)

  return Math.max(
    1,
    Math.min(preferred, Math.sqrt(areaLimit / area), MAX_CANVAS_DIMENSION / Math.max(1, height)),
  )
}

/**
 * Клон итогового экрана для замера высоты PDF-вёрстки.
 *
 * Кнопки и навигация помечены `.no-print` — в PDF их не должно быть.
 * Журналы партий на экране прокручиваются (max-height: 200px), но в PDF
 * они должны быть видны целиком, поэтому перед замером они раскрываются.
 *
 * @param {HTMLElement} element
 * @param {number} [width]
 * @returns {{ element: HTMLElement, clone: HTMLElement, height: number, remove: () => void }}
 */
export function createPdfSource(element, width = PDF_RENDER_WIDTH_PX) {
  const holder = document.createElement('div')
  holder.dataset.pdfSource = ''
  holder.style.cssText = `position: fixed; left: -10000px; top: 0; width: ${width}px;`

  const clone = element.cloneNode(true)
  clone.style.padding = `${PDF_PADDING_PX}px`
  clone.querySelectorAll('.no-print').forEach((node) => node.remove())
  clone.querySelectorAll('.point-log__scroll').forEach((node) => {
    node.style.maxHeight = 'none'
    node.style.overflow = 'visible'
  })

  holder.append(clone)
  document.body.append(holder)

  return {
    element: holder,
    clone,
    height: holder.getBoundingClientRect().height,
    remove: () => holder.remove(),
  }
}

/**
 * Одна страница с пропорциями снимка: ширина A4, высота — во всё содержимое.
 *
 * @param {{ width: number, height: number }} params
 * @returns {[number, number]}
 */
export function pdfPageFormat({ width = PDF_RENDER_WIDTH_PX, height }) {
  const contentWidth = PDF_PAGE_WIDTH_MM - PDF_MARGIN_MM * 2

  return [
    PDF_PAGE_WIDTH_MM,
    (contentWidth * height) / width + PDF_MARGIN_MM * 2 + PAGE_HEIGHT_BUFFER_MM,
  ]
}

/**
 * @param {{ filename: string, height: number, width?: number, isIos?: boolean, singlePage?: boolean }} params
 * @returns {object}
 */
export function pdfOptions({
  filename,
  height,
  width = PDF_RENDER_WIDTH_PX,
  windowWidth = PDF_WIDTH,
  isIos = isIosDevice(),
  singlePage = false,
}) {
  const options = {
    margin: PDF_MARGIN_MM,
    filename,
    image: { type: 'jpeg', quality: 0.95 },
    html2canvas: {
      scale: chooseCanvasScale({ width, height, isIos }),
      useCORS: true,
      windowWidth,
      windowHeight: 900,
      backgroundColor: '#ffffff',
      ignoreElements: (node) => node.classList?.contains('no-print') === true,
      onclone: (clonedDocument) => {
        clonedDocument
          .querySelectorAll('.table-wrap, .point-log__scroll')
          .forEach((node) => {
            node.scrollLeft = 0
            node.scrollTop = 0
          })

        const style = clonedDocument.createElement('style')
        style.textContent = `
          .point-log__scroll { max-height: none !important; overflow: visible !important; }
          .point-log__table thead th { position: static !important; }
          .stats-table { min-width: 0 !important; font-size: 0.72rem !important; }
          .stats-table th, .stats-table td { padding: 4px 3px !important; }
          .stats-table th:first-child { position: static !important; box-shadow: none !important; }
          .table-wrap { overflow: visible !important; }
        `
        clonedDocument.head.append(style)
      },
    },
    jsPDF: {
      unit: 'mm',
      format: singlePage ? pdfPageFormat({ width, height }) : 'a4',
      orientation: 'portrait',
    },
  }

  if (!singlePage) {
    options.pagebreak = { mode: ['css', 'legacy'], avoid: ['.stat-line', 'tr', 'h2', 'h3'] }
  }

  return options
}

function resetScrolls(element) {
  return [...element.querySelectorAll('.table-wrap, .point-log__scroll')].map((node) => {
    const saved = { node, scrollLeft: node.scrollLeft, scrollTop: node.scrollTop }
    node.scrollLeft = 0
    node.scrollTop = 0
    return saved
  })
}

function restoreScrolls(saved) {
  for (const { node, scrollLeft, scrollTop } of saved) {
    node.scrollLeft = scrollLeft
    node.scrollTop = scrollTop
  }
}

/** @returns {Promise<Blob>} */
async function renderWithHtml2pdf(element, options) {
  const { default: html2pdf } = await import('html2pdf.js')

  return html2pdf().set(options).from(element).outputPdf('blob')
}

/**
 * @param {HTMLElement | null | undefined} element
 * @param {{ filename?: string, isIos?: boolean, singlePage?: boolean, render?: Function }} [options]
 * @returns {Promise<Blob>}
 */
export async function generateSummaryPdf(
  element,
  {
    filename = buildPdfFilename(),
    isIos = isIosDevice(),
    singlePage = false,
    render = renderWithHtml2pdf,
  } = {},
) {
  if (!element) throw new Error('summary element not found')

  const source = createPdfSource(element)
  const { height } = source
  source.remove()

  const savedScrolls = resetScrolls(element)
  try {
    return await render(element, pdfOptions({ filename, height, isIos, singlePage }))
  } finally {
    restoreScrolls(savedScrolls)
  }
}

function canShareFile(file) {
  try {
    return typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })
  } catch {
    return false
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename

  document.body.append(link)
  link.click()
  link.remove()

  setTimeout(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
}

/**
 * Отдаёт PDF пользователю: на iOS — системное «Поделиться», иначе скачивание.
 *
 * @param {Blob} blob
 * @param {string} filename
 * @param {{ isIos?: boolean }} [options]
 * @returns {Promise<'shared' | 'downloaded' | 'cancelled'>}
 */
export async function savePdf(blob, filename, { isIos = isIosDevice() } = {}) {
  if (isIos) {
    const file = new File([blob], filename, { type: 'application/pdf' })

    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file], title: 'Итоги матча' })
        return 'shared'
      } catch (error) {
        if (error?.name === 'AbortError') return 'cancelled'
      }
    }
  }

  downloadBlob(blob, filename)
  return 'downloaded'
}
