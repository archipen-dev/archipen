import type { Asset } from '../model/schema'

const SVG_NS = 'http://www.w3.org/2000/svg'

/** SVG elements an icon may use. Anything else (scripts, HTML, animation, foreign content) is removed with its contents. */
const ALLOWED_TAGS = new Set(
  (
    'svg g path circle ellipse line polyline polygon rect defs symbol use desc text tspan textpath style marker image ' +
    'lineargradient radialgradient stop clippath mask pattern filter ' +
    'feblend fecolormatrix fecomponenttransfer fecomposite feconvolvematrix fediffuselighting fedisplacementmap fedistantlight ' +
    'fedropshadow feflood fefunca fefuncb fefuncg fefuncr fegaussianblur feimage femerge femergenode femorphology feoffset ' +
    'fepointlight fespecularlighting fespotlight fetile feturbulence'
  ).split(' '),
)

/** `data:` images an icon may embed. Anything else (other files, URLs, nested SVG documents) is dropped. */
const SAFE_DATA_IMAGE = /^data:image\/(png|jpeg|gif|webp)[;,]/i
/** Namespaced attributes that are kept. Any other prefix could declare its own name for xlink:href. */
const ALLOWED_PREFIXED = new Set(['xlink:href', 'xml:space'])
/** CSS that could fetch something or hide from the checks below: escapes, at-rules, external urls. */
const UNSAFE_CSS = /[\\@<]|image-set|expression\s*\(|url\(\s*['"]?(?!#)/i

/** A selector naming only this icon's own prefixed classes and ids (see sanitizeSvg), so it can't style the page. */
const OWN = String.raw`[.#]ap[a-z0-9]+-[\w-]+`
const OWN_SELECTOR = new RegExp(String.raw`^${OWN}(?:\s*[\s,>+~]\s*${OWN})*$`, 'i')

/**
 * The stylesheet if every rule targets the icon's own classes and ids and nothing in it can load
 * a resource, else null. Inline SVG styles apply to the whole page, so anything broader is dropped.
 */
function safeStylesheet(css: string, ownSelectorsOnly: boolean): string | null {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '').trim()
  if (UNSAFE_CSS.test(text)) return null
  if (!ownSelectorsOnly) return text
  const rules = text.split('}')
  if (rules.pop()!.trim()) return null
  for (const rule of rules) {
    const parts = rule.split('{')
    if (parts.length !== 2 || !OWN_SELECTOR.test(parts[0].trim())) return null
  }
  return text
}

/**
 * Remove everything unsafe below `root` (in place): elements outside the allowlist, event handlers,
 * foreign namespaces, external references, and CSS that could load something or reach outside the icon.
 * Uploads are scrubbed once before their classes get the icon prefix, so that pass skips the selector check.
 */
function scrub(root: Element, upload: boolean) {
  for (const el of Array.from(root.querySelectorAll('*'))) {
    const nsOk = el.namespaceURI === SVG_NS || (upload && el.namespaceURI === null)
    if (!nsOk || !ALLOWED_TAGS.has(el.localName.toLowerCase())) {
      el.remove()
      continue
    }
    for (const attr of Array.from(el.attributes)) {
      const n = attr.name.toLowerCase()
      const v = attr.value.trim()
      const unsafe =
        n.startsWith('on') ||
        n.startsWith('xmlns') ||
        (n.includes(':') && !ALLOWED_PREFIXED.has(n)) ||
        (attr.localName.toLowerCase() === 'href' && !v.startsWith('#') && !SAFE_DATA_IMAGE.test(v)) ||
        // Presentation attributes and style="" are CSS too.
        UNSAFE_CSS.test(v)
      if (unsafe) el.removeAttribute(attr.name)
    }
    if (el.localName.toLowerCase() === 'style') {
      const css = safeStylesheet(el.textContent ?? '', !upload)
      if (css === null) el.remove()
      else el.textContent = css
    }
  }
}

/**
 * Clean stored icon markup (an asset `body`) before it is rendered.
 * It is parsed with the HTML parser inside an <svg>, exactly as the canvas will parse it,
 * so what gets checked is what gets drawn. Needs a DOM (browser or jsdom).
 */
export function sanitizeAssetBody(body: string): string {
  const doc = new DOMParser().parseFromString(`<!doctype html><body><svg>${body}</svg>`, 'text/html')
  const svg = doc.body.querySelector('svg')
  if (!svg) return ''
  scrub(svg, false)
  return svg.innerHTML
}

export function sanitizeSvg(source: string, id: string, name: string): Asset {
  const parsed = new DOMParser().parseFromString(source, 'image/svg+xml')
  const svg = parsed.documentElement
  if (!svg || svg.nodeName.toLowerCase() !== 'svg' || parsed.querySelector('parsererror')) {
    throw new Error('That file is not a valid SVG.')
  }

  const prefix = `ap${id.replace(/[^a-z0-9]/gi, '')}-`
  scrub(svg, true)

  // Prefix ids and every reference to them.
  const ids = new Set(Array.from(svg.querySelectorAll('[id]')).map((e) => e.id))
  const classes = new Set<string>()
  for (const el of Array.from(svg.querySelectorAll('[class]'))) {
    for (const c of (el.getAttribute('class') ?? '').split(/\s+/)) if (c) classes.add(c)
  }
  for (const el of Array.from(svg.querySelectorAll('*'))) {
    if (el.id) el.id = prefix + el.id
    const cls = el.getAttribute('class')
    if (cls)
      el.setAttribute(
        'class',
        cls
          .split(/\s+/)
          .filter(Boolean)
          .map((c) => prefix + c)
          .join(' '),
      )
    for (const attr of Array.from(el.attributes)) {
      if (attr.name === 'id' || attr.name === 'class') continue
      let v = attr.value
      for (const ref of ids) {
        v = v.split(`url(#${ref})`).join(`url(#${prefix}${ref})`)
        if (v === `#${ref}`) v = `#${prefix}${ref}`
      }
      if (v !== attr.value) el.setAttribute(attr.name, v)
    }
  }
  for (const style of Array.from(svg.querySelectorAll('style'))) {
    let css = style.textContent ?? ''
    for (const c of classes) css = css.replace(new RegExp(`\\.${c.replace(/[^\w-]/g, '\\$&')}(?![\\w-])`, 'g'), `.${prefix}${c}`)
    for (const ref of ids) css = css.split(`#${ref}`).join(`#${prefix}${ref}`)
    style.textContent = css
  }

  let viewBox: [number, number, number, number] | null = null
  const vb = svg.getAttribute('viewBox')?.trim().split(/[\s,]+/).map(Number)
  if (vb && vb.length === 4 && vb.every(Number.isFinite) && vb[2] > 0 && vb[3] > 0) viewBox = vb as [number, number, number, number]
  if (!viewBox) {
    const w = parseFloat(svg.getAttribute('width') ?? '')
    const h = parseFloat(svg.getAttribute('height') ?? '')
    viewBox = [0, 0, w > 0 ? w : 24, h > 0 ? h : 24]
  }

  // Root presentation attributes (fill/stroke on <svg>) would be lost; carry them on a wrapper group.
  const keep = ['fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'fill-rule', 'opacity', 'style']
  const wrapperAttrs = keep
    .map((k) => [k, svg.getAttribute(k)] as const)
    .filter(([, v]) => v != null)
    .map(([k, v]) => `${k}="${v!.replace(/"/g, '&quot;')}"`)
    .join(' ')
  const ser = new XMLSerializer()
  const inner = Array.from(svg.childNodes)
    .map((n) => ser.serializeToString(n))
    .join('')
    .replace(/\s+xmlns(:\w+)?="[^"]*"/g, '')
  const body = sanitizeAssetBody(wrapperAttrs ? `<g ${wrapperAttrs}>${inner}</g>` : inner)
  if (body.length > 400_000) throw new Error('SVG is too large (max ~400 KB).')
  return { id, name, viewBox, body }
}
