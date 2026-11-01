/*
 * Export formats as a strategy table: each kind knows how to turn a diagram into a file.
 * PNG draws the page on screen. SVG and PDF draw every page (a clickable SVG, a multi-page PDF) or just that one.
 * The SVG builder pulls in react-dom/server, so it loads with the first export.
 */
import { pageById } from '../model/pages'
import type { Doc } from '../model/schema'
import type { CanvasTheme } from '../render/theme'
import { exportPdf, PDF_FONT } from './exportPdf'
import { exportPng } from './exportPng'
import { baseName } from './fileIO'
import { fontFaceCss } from './fonts'

export type ExportKind = 'svg' | 'svg-small' | 'svg-animated' | 'png-2x' | 'png-3x' | 'png-transparent' | 'pdf'

export interface ExportResult {
  blob: Blob
  filename: string
}

/** Which pages to export: `page` is the one on screen; `all` asks for every page where the format allows it. */
export interface ExportScope {
  page: string
  all: boolean
}

interface Exporter {
  format: 'SVG' | 'PNG' | 'PDF'
  run: (doc: Doc, theme: CanvasTheme, scope: ExportScope) => Promise<ExportResult>
}

async function builder(doc: Doc) {
  const svg = await import('../export/buildSvg')
  await svg.prepareIcons(doc)
  return svg
}

/** "Shop" for a whole diagram, "Shop - Checkout" for one page of a bigger one. */
function fileName(doc: Doc, page: string | undefined) {
  if (page === undefined || doc.pages.length < 2) return baseName(doc)
  const p = pageById(doc, page)
  return `${baseName(doc)} - ${baseName({ name: p.name || p.id })}`
}

const onePage = (doc: Doc, scope: ExportScope) => (scope.all && doc.pages.length > 1 ? undefined : scope.page)

function svgExporter(opts: { animate?: boolean; embedFont: boolean }): Exporter {
  return {
    format: 'SVG',
    run: async (doc, theme, scope) => {
      const { renderSvgString } = await builder(doc)
      const fontCss = opts.embedFont ? await fontFaceCss() : undefined
      const page = onePage(doc, scope)
      const { svg } = renderSvgString(doc, { theme, page, animate: opts.animate, fontCss })
      return { blob: new Blob([svg], { type: 'image/svg+xml' }), filename: `${fileName(doc, page)}.svg` }
    },
  }
}

function pngExporter(scale: 2 | 3, background = true): Exporter {
  return {
    format: 'PNG',
    run: async (doc, theme, { page }) => {
      const { renderSvgString } = await builder(doc)
      const { svg, width, height } = renderSvgString(doc, { theme, page, background, fontCss: await fontFaceCss() })
      return { blob: await exportPng(svg, width, height, scale), filename: `${fileName(doc, page)}@${scale}x.png` }
    },
  }
}

const pdfExporter: Exporter = {
  format: 'PDF',
  run: async (doc, theme, scope) => {
    const { renderPagesSvg, renderSvgString } = await builder(doc)
    const page = onePage(doc, scope)
    const opts = { theme, pdfFont: PDF_FONT }
    const pages = page === undefined ? renderPagesSvg(doc, opts) : [renderSvgString(doc, { ...opts, page })]
    return { blob: await exportPdf(pages), filename: `${fileName(doc, page)}.pdf` }
  },
}

export const EXPORTERS: Record<ExportKind, Exporter> = {
  svg: svgExporter({ embedFont: true }),
  'svg-animated': svgExporter({ embedFont: true, animate: true }),
  'svg-small': svgExporter({ embedFont: false }),
  pdf: pdfExporter,
  'png-2x': pngExporter(2),
  'png-3x': pngExporter(3),
  'png-transparent': pngExporter(2, false),
}
