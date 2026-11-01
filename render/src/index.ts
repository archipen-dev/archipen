// Render Archipen diagrams to SVG, PNG and PDF in Node: no browser involved.
// The SVG comes from the same builder the app's export menu uses (app/src/export/buildSvg.tsx).
import './env'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Resvg } from '@resvg/resvg-js'
import PDFDocument from 'pdfkit'
import SVGtoPDF from 'svg-to-pdfkit'
import { fontFaceRule } from '../../app/src/export/fontCss'
import { prepareIcons, renderPagesSvg, renderSvgString, type SvgResult } from '../../app/src/export/buildSvg'
import { MAX_RASTER_SIDE, rasterScale, RenderLimitError } from '../../app/src/export/limits'
import type { Projection } from '../../app/src/geometry/projection'
import { formatIssue, validateDoc, type Issue } from '../../app/src/model/parse'
import type { Doc } from '../../app/src/model/schema'
import { DARK, LIGHT } from '../../app/src/render/theme'

export type Format = 'svg' | 'png' | 'pdf'
export const FORMATS: readonly Format[] = ['svg', 'png', 'pdf']
export type { Issue }

/** One issue as a line of text, e.g. `error: edges[2].to.nodeId — …`. */
export const formatIssueLine = (i: Issue) => `${i.level}: ${formatIssue(i)}`

export interface RenderOptions {
  /** Colour theme. Default "light". */
  theme?: 'light' | 'dark'
  /**
   * Id of the page to draw. Without it, SVG holds every page (linked items are clickable) and PDF has one PDF page
   * per diagram page; PNG, which can only show one, draws the first page.
   */
  page?: string
  /** "iso" or "2d". Defaults to the projection saved in the file. */
  projection?: Projection
  /** Fill the background with the theme colour. Default true; false gives a transparent PNG/SVG. */
  background?: boolean
  /** Keep the animated flow on wires (SVG only). Default false. */
  animate?: boolean
  /** Space around the diagram in px. Default 32. */
  padding?: number
  /** Pixel density for PNG. Default 2, at most 8. */
  scale?: number
  /** Embed the font in the SVG (about 40 KB), so text looks the same everywhere. Default true. */
  embedFont?: boolean
}

/** The file could not be loaded. `issues` lists every problem, like `npm run validate`. */
export class DiagramError extends Error {
  constructor(public readonly issues: Issue[]) {
    const errors = issues.filter((i) => i.level === 'error')
    super(`Not a valid Archipen file:\n${errors.map((i) => `- ${formatIssue(i)}`).join('\n')}`)
    this.name = 'DiagramError'
  }
}

export const MAX_SCALE = 8
/** Largest PNG side in pixels; the scale is lowered to stay within it (and within a 64 MP area). */
export const MAX_PNG_SIDE = MAX_RASTER_SIDE
export { RenderLimitError }

// The package's fonts/ folder: one level up from src/ and dist/, two from bundled chunks in dist/chunks/.
const fontsDir = ['../fonts/', '../../fonts/'].map((rel) => new URL(rel, import.meta.url)).find((u) => existsSync(new URL('InstrumentSans-Regular.ttf', u)))
if (!fontsDir) throw new Error('@archipen/render: fonts/ folder not found (run "npm run fonts" in render/)')
const fontPath = (name: string) => fileURLToPath(new URL(name, fontsDir))
const FONT_REGULAR = fontPath('InstrumentSans-Regular.ttf')
const FONT_SEMIBOLD = fontPath('InstrumentSans-SemiBold.ttf')
let fontCss: string | undefined
const svgFontCss = () => (fontCss ??= fontFaceRule(readFileSync(fontPath('InstrumentSans-Variable.woff2')).toString('base64')))

/**
 * Custom icons in a file are cleaned with DOMParser before they are drawn. Node has none,
 * so jsdom provides it, loaded only for files that actually contain custom icons.
 */
async function ensureDomParser(raw: unknown) {
  if (typeof globalThis.DOMParser !== 'undefined') return
  const assets = (raw as { assets?: unknown } | null)?.assets
  if (!assets || typeof assets !== 'object' || !Object.keys(assets).length) return
  const { JSDOM } = await import('jsdom')
  globalThis.DOMParser = new JSDOM('').window.DOMParser as unknown as typeof DOMParser
}

/**
 * Validate a diagram: a parsed object, or JSON text. Never throws on bad content.
 * `doc` is null when there are errors; warnings point at things that will look wrong.
 */
export async function validateDiagram(input: unknown): Promise<{ doc: Doc | null; issues: Issue[] }> {
  let raw = input
  if (typeof input === 'string' || input instanceof Uint8Array) {
    try {
      raw = JSON.parse(typeof input === 'string' ? input : new TextDecoder().decode(input))
    } catch (e) {
      return { doc: null, issues: [{ level: 'error', path: '', message: `not valid JSON: ${(e as Error).message}` }] }
    }
  }
  await ensureDomParser(raw)
  return validateDoc(raw)
}

async function load(input: unknown, page?: string): Promise<Doc> {
  const { doc, issues } = await validateDiagram(input)
  if (!doc) throw new DiagramError(issues)
  if (page !== undefined && !doc.pages.some((p) => p.id === page))
    throw new DiagramError([{ level: 'error', path: 'pages', message: `No page with id "${page}" (the file has ${doc.pages.map((p) => `"${p.id}"`).join(', ')}).` }])
  await prepareIcons(doc)
  return doc
}

const theme = (o: RenderOptions) => (o.theme === 'dark' ? DARK : LIGHT)
type Extra = { fontCss?: string; pdfFont?: string; animate?: boolean }
const svgOptions = (o: RenderOptions, extra: Extra) => ({ theme: theme(o), projection: o.projection, background: o.background, padding: o.padding, animate: false, ...extra })
const svgFor = (doc: Doc, o: RenderOptions, extra: Extra = {}): SvgResult => renderSvgString(doc, { ...svgOptions(o, extra), page: o.page })

/** Render to a standalone SVG file: every page with clickable links, or the one in `opts.page`. */
export async function renderSvg(input: unknown, opts: RenderOptions = {}): Promise<string> {
  const doc = await load(input, opts.page)
  return svgFor(doc, opts, { animate: opts.animate ?? false, fontCss: opts.embedFont === false ? undefined : svgFontCss() }).svg
}

/** Render one page (`opts.page`, else the first) to PNG with resvg, using the bundled Instrument Sans (no system fonts, so output is the same on every machine). */
export async function renderPng(input: unknown, opts: RenderOptions = {}): Promise<Buffer> {
  const doc = await load(input, opts.page)
  const { svg, width, height } = svgFor(doc, { ...opts, page: opts.page ?? doc.pages[0].id })
  const scale = rasterScale(width, height, Math.min(opts.scale ?? 2, MAX_SCALE))
  const resvg = new Resvg(svg, {
    fitTo: { mode: 'zoom', value: scale },
    font: { fontFiles: [FONT_REGULAR, FONT_SEMIBOLD], loadSystemFonts: false, defaultFontFamily: 'Instrument Sans' },
    imageRendering: 0,
    shapeRendering: 2,
    textRendering: 1,
  })
  return resvg.render().asPng()
}

/**
 * Render to a vector PDF with the font embedded: one PDF page per diagram page (empty ones skipped),
 * each the size of its drawing (1 px = 1 pt). With `page`, just that page.
 */
export async function renderPdf(input: unknown, opts: RenderOptions = {}): Promise<Buffer> {
  const doc = await load(input, opts.page)
  const extra = { pdfFont: 'InstrumentSans' }
  const pages = opts.page !== undefined ? [svgFor(doc, opts, extra)] : renderPagesSvg(doc, svgOptions(opts, extra))
  const pdf = new PDFDocument({ autoFirstPage: false, margin: 0, compress: true, info: { Title: doc.name, Creator: 'Archipen' } })
  pdf.registerFont('InstrumentSans', FONT_REGULAR)
  pdf.registerFont('InstrumentSans-Bold', FONT_SEMIBOLD)
  const chunks: Buffer[] = []
  pdf.on('data', (c: Buffer) => chunks.push(c))
  const done = new Promise<void>((resolve, reject) => {
    pdf.on('end', resolve)
    pdf.on('error', reject)
  })
  for (const { svg, width, height } of pages) {
    pdf.addPage({ size: [width, height], margin: 0 })
    SVGtoPDF(pdf, svg, 0, 0, {
      width,
      height,
      assumePt: true,
      fontCallback: (_family: string, bold: boolean) => (bold ? 'InstrumentSans-Bold' : 'InstrumentSans'),
    })
  }
  pdf.end()
  await done
  return Buffer.concat(chunks)
}

/** Render to any format. SVG comes back as UTF-8 bytes. */
export async function render(input: unknown, format: Format, opts: RenderOptions = {}): Promise<Buffer> {
  if (format === 'svg') return Buffer.from(await renderSvg(input, opts), 'utf8')
  if (format === 'png') return renderPng(input, opts)
  if (format === 'pdf') return renderPdf(input, opts)
  throw new Error(`Unknown format "${format as string}" (use svg, png or pdf)`)
}

export const CONTENT_TYPES: Record<Format, string> = {
  svg: 'image/svg+xml; charset=utf-8',
  png: 'image/png',
  pdf: 'application/pdf',
}

/** File name for a diagram, from its title (same rule as the app's downloads). */
export const fileBaseName = (name: string) => name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'diagram'
