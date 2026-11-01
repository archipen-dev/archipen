import { renderToStaticMarkup } from 'react-dom/server'
import type { Projection } from '../geometry/projection'
import { buildScene } from '../geometry/scene'
import { loadAllVendorIcons, needsMoreVendorIcons } from '../icons/vendorLoader'
import { pageView } from '../model/pages'
import type { Doc } from '../model/schema'
import { RenderModeContext, type RenderMode } from '../render/mode'
import { SceneView } from '../render/Scene'
import { FONT_STACK, type CanvasTheme } from '../render/theme'
import { describeScene } from '../render/describe'
import { EmptyDiagramError, MAX_SVG_SIDE, RenderLimitError } from './limits'

export interface SvgOptions {
  theme: CanvasTheme
  /** Id of the page to draw. Without it a diagram with several pages gives one file with all of them, linked. */
  page?: string
  /** Defaults to the document's own projection. */
  projection?: Projection
  /** Fill the page with the theme background. Default true. */
  background?: boolean
  /** Keep the CSS flow animation on wires. Default false. */
  animate?: boolean
  /** Space around the diagram, in px. Default 32. */
  padding?: number
  /** Inline `@font-face` CSS, so text renders the same everywhere. */
  fontCss?: string
  /** Draw text for PDF conversion with this font family (see RenderMode.pdfFont). */
  pdfFont?: string
}

export interface SvgResult {
  /** A standalone SVG file, XML declaration included. */
  svg: string
  width: number
  height: number
}

/** Page id → name, for the link sentences. */
export const pageNames = (doc: Doc) => new Map(doc.pages.map((p) => [p.id, p.name || p.id]))

const NS = 'http://www.w3.org/2000/svg'
const XLINK = 'http://www.w3.org/1999/xlink'
const text = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const attr = (v: string) => text(v).replace(/"/g, '&quot;')

/** Make sure every vendor logo the document uses can be drawn. Call before renderSvgString. */
export async function prepareIcons(doc: Doc): Promise<void> {
  if (needsMoreVendorIcons(doc.pages.flatMap((p) => p.nodes.map((n) => n.icon)))) await loadAllVendorIcons()
}

/** Element id of a page in a multi-page SVG (also the link target). */
export const pageElementId = (id: string) => `ap-page-${id.replace(/[^\w-]/g, (c) => `_${c.codePointAt(0)!.toString(16)}_`)}`

interface PageDrawing {
  id: string
  name: string
  summary: string
  /** The drawing's area, padding included, in scene coordinates. */
  x: number
  y: number
  width: number
  height: number
  body: string
}

/** One page's scene and size, or null when nothing on it is visible. */
function pageScene(source: Doc, pageId: string | undefined, opts: SvgOptions) {
  const doc = pageView(source, pageId)
  const scene = buildScene(doc, opts.projection ?? doc.settings.projection)
  const b = scene.bounds
  if (!b || (b.w === 0 && b.h === 0)) return null
  const pad = opts.padding ?? 32
  const x = Math.floor(b.x - pad)
  const y = Math.floor(b.y - pad)
  return { doc, scene, x, y, width: Math.ceil(b.x + b.w + pad) - x, height: Math.ceil(b.y + b.h + pad) - y }
}

/** Draw a page's items as SVG markup. `links` (item id → href) makes linked items clickable. */
function drawPage(source: Doc, page: NonNullable<ReturnType<typeof pageScene>>, opts: SvgOptions, links?: Map<string, string>): PageDrawing {
  // Screen readers get a text summary, and a role and title on every item.
  const described = describeScene(page.scene, pageNames(source))
  const mode: RenderMode = { bare: true, pdfFont: opts.pdfFont, a11y: described.items, links }
  // Rendered inside an <svg> so React treats <title> as SVG (it hoists HTML titles); the wrapper is cut off below.
  const wrapped = renderToStaticMarkup(
    <svg>
      <RenderModeContext.Provider value={mode}>
        <SceneView scene={page.scene} assets={source.assets} theme={opts.theme} animate={opts.animate ?? false} />
      </RenderModeContext.Provider>
    </svg>,
  )
  // Icon bodies are stored as HTML-serialized markup; &nbsp; is the one HTML entity XML doesn't know.
  const body = wrapped.slice('<svg>'.length, -'</svg>'.length).replace(/&nbsp;/g, '&#160;')
  const { x, y, width, height } = page
  return { id: page.doc.pageId, name: page.doc.pageName, summary: described.summary, x, y, width, height, body }
}

const checkSize = (width: number, height: number) => {
  if (!(width <= MAX_SVG_SIDE && height <= MAX_SVG_SIDE)) throw new RenderLimitError(`The diagram is too large to export (${width} × ${height} px, at most ${MAX_SVG_SIDE} a side)`)
}

const svgOpen = (viewBox: string, width: number, height: number, extra = '') =>
  `<svg xmlns="${NS}" xmlns:xlink="${XLINK}"${extra} viewBox="${viewBox}" width="${width}" height="${height}"` +
  ` role="graphics-document" aria-roledescription="diagram" aria-labelledby="ap-title" aria-describedby="ap-desc">`

/**
 * Draw a document as a standalone SVG string. Needs no DOM, so the browser export and the
 * command-line renderer produce the same file. Plain vector SVG: paths, polygons and text, no foreignObject.
 *
 * With `page`, or for a one-page diagram, the file shows that page. Otherwise it holds every page that has
 * something on it, and clicking a linked node or zone shows its page (CSS `:target`, no script).
 */
export function renderSvgString(source: Doc, opts: SvgOptions): SvgResult {
  if (opts.page === undefined && source.pages.length > 1) return renderAllPages(source, opts)
  const page = pageScene(source, opts.page, opts)
  if (!page) throw new EmptyDiagramError(source.pages.length > 1 ? `The page "${pageView(source, opts.page).pageName || opts.page}" is empty` : undefined)
  checkSize(page.width, page.height)
  const d = drawPage(source, page, opts)
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    svgOpen(`${d.x} ${d.y} ${d.width} ${d.height}`, d.width, d.height),
    `<title id="ap-title">${text(source.name.trim() || 'Untitled diagram')}</title>`,
    `<desc id="ap-desc">${text(d.summary)}</desc>`,
  ]
  if (opts.background ?? true) parts.push(`<rect x="${d.x}" y="${d.y}" width="${d.width}" height="${d.height}" fill="${attr(opts.theme.bg)}"/>`)
  if (opts.fontCss) parts.push(`<style>${opts.fontCss}</style>`)
  parts.push(d.body, '</svg>')
  return { svg: parts.join(''), width: d.width, height: d.height }
}

/** Shows one page at a time: the one in the URL fragment, else the first (drawn last, so a targeted page hides it). */
const PAGE_CSS = '.ap-page{display:none}.ap-page:target,.ap-start{display:inline}.ap-page:target~.ap-start{display:none}a{cursor:pointer}'

/** Every page with something on it in one file, all at the size of the largest, linked items clickable. */
function renderAllPages(source: Doc, opts: SvgOptions): SvgResult {
  const scenes = source.pages.map((p) => pageScene(source, p.id, opts)).filter((p) => p !== null)
  if (!scenes.length) throw new EmptyDiagramError()
  if (scenes.length === 1) return renderSvgString(source, { ...opts, page: scenes[0].doc.pageId })

  const drawn = new Set(scenes.map((p) => p.doc.pageId))
  const links = new Map<string, string>()
  for (const p of source.pages)
    for (const it of [...p.nodes, ...p.zones]) if (it.link && drawn.has(it.link.page)) links.set(it.id, `#${pageElementId(it.link.page)}`)
  const pages = scenes.map((p) => drawPage(source, p, opts, links))
  const width = Math.max(...pages.map((p) => p.width))
  const height = Math.max(...pages.map((p) => p.height))
  checkSize(width, height)

  const start = pages[0]
  const label = (p: PageDrawing) => p.name.trim() || 'Untitled page'
  const nested = (p: PageDrawing) => {
    // Every page is shown at the same scale, centred in the shared frame.
    const vx = Math.round(p.x + p.width / 2 - width / 2)
    const vy = Math.round(p.y + p.height / 2 - height / 2)
    const isStart = p === start
    const back = isStart
      ? ''
      : `<a href="#${pageElementId(start.id)}"><text x="${vx + 20}" y="${vy + 28}" font-family="${attr(opts.pdfFont ?? FONT_STACK)}" font-size="13" font-weight="600" fill="${attr(opts.theme.muted)}">‹ ${text(label(start))}</text></a>`
    return (
      `<svg id="${pageElementId(p.id)}" class="ap-page${isStart ? ' ap-start' : ''}" viewBox="${vx} ${vy} ${width} ${height}" width="${width}" height="${height}"` +
      ` role="group" aria-label="${attr(`Page ${label(p)}`)}"><desc>${text(p.summary)}</desc>${back}${p.body}</svg>`
    )
  }
  const parts = [
    '<?xml version="1.0" encoding="UTF-8"?>\n',
    svgOpen(`0 0 ${width} ${height}`, width, height, ' class="ap-root"'),
    `<title id="ap-title">${text(source.name.trim() || 'Untitled diagram')}</title>`,
    `<desc id="ap-desc">${text(`Diagram with ${pages.length} pages: ${pages.map(label).join(', ')}. Linked items open their page.`)}</desc>`,
    `<style>${PAGE_CSS}${opts.fontCss ?? ''}</style>`,
  ]
  if (opts.background ?? true) parts.push(`<rect width="${width}" height="${height}" fill="${attr(opts.theme.bg)}"/>`)
  // The first page goes last: `.ap-page:target ~ .ap-start` hides it when another page is shown.
  parts.push(...pages.slice(1).map(nested), nested(start), '</svg>')
  return { svg: parts.join(''), width, height }
}

/**
 * Every page with something on it, in order, for multi-page formats (PDF).
 * Throws EmptyDiagramError when no page has anything to draw.
 */
export function renderPagesSvg(doc: Doc, opts: Omit<SvgOptions, 'page'>): (SvgResult & { pageName: string })[] {
  const out: (SvgResult & { pageName: string })[] = []
  for (const page of doc.pages) {
    try {
      out.push({ ...renderSvgString(doc, { ...opts, page: page.id }), pageName: page.name })
    } catch (e) {
      if (!(e instanceof EmptyDiagramError)) throw e
    }
  }
  if (!out.length) throw new EmptyDiagramError()
  return out
}
