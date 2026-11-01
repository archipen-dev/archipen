import { LUCIDE_ICONS } from '../icons/lucideSet'
import { VENDOR_ICONS } from '../icons/vendorSet'
import { sanitizeAssetBody } from '../icons/sanitize'
import { newId } from './ids'
import { recomputeMembership } from './membership'
import { Doc as DocSchema, endId, FILE_VERSION, type Doc, type Page } from './schema'

export interface Issue {
  /** Errors stop the file from loading; warnings point at things that will look wrong. */
  level: 'error' | 'warning'
  /** Where in the file, e.g. `edges[2].to.nodeId`. Empty for the root. */
  path: string
  message: string
}

export interface ValidationResult {
  /** The loaded document, or null when it has errors. */
  doc: Doc | null
  issues: Issue[]
}

const ITEM_LISTS = ['nodes', 'zones', 'edges', 'texts'] as const

const fmtPath = (path: readonly PropertyKey[]) =>
  path.map((p, i) => (typeof p === 'number' ? `[${p}]` : i === 0 ? String(p) : `.${String(p)}`)).join('')

/**
 * Validate and load unknown JSON as a diagram. Never throws.
 * Fills in defaults, derives zone membership from positions, sanitizes custom icons,
 * and checks the rules the schema can't express (unique ids, wire ends, links, icons, overlaps).
 */
export function validateDoc(raw: unknown): ValidationResult {
  // A newer format may use fields and values this version doesn't know: refuse it before they get dropped.
  const version = raw && typeof raw === 'object' ? (raw as { version?: unknown }).version : undefined
  if (typeof version === 'number' && version > FILE_VERSION)
    return {
      doc: null,
      issues: [
        {
          level: 'error',
          path: 'version',
          message: `Made with a newer Archipen (file format version ${version}). This version reads format version ${FILE_VERSION} and older; update Archipen to open it.`,
        },
      ],
    }
  // Items go inside pages; at the top level they would be dropped without a word.
  const stray = raw && typeof raw === 'object' ? ITEM_LISTS.filter((k) => k in raw) : []
  if (stray.length) return { doc: null, issues: stray.map((k) => ({ level: 'error', path: k, message: `Items go inside a page: move "${k}" into pages[0].` })) }
  const result = DocSchema.safeParse(raw)
  if (!result.success) {
    return { doc: null, issues: result.error.issues.map((i) => ({ level: 'error', path: fmtPath(i.path), message: i.message })) }
  }
  const doc = result.data
  if (!doc.id) doc.id = newId('d')
  for (const page of doc.pages) recomputeMembership(page)
  // The canvas injects asset markup as HTML, so files from anywhere must be cleaned. Without a DOM (CLI) nothing is rendered.
  if (typeof DOMParser !== 'undefined') for (const a of Object.values(doc.assets)) a.body = sanitizeAssetBody(a.body)
  const issues = checkDoc(doc)
  return { doc: issues.some((i) => i.level === 'error') ? null : doc, issues }
}

export const formatIssue = (i: Issue) => `${i.path || 'root'} — ${i.message}`

/** Parse and validate unknown JSON as a diagram document. Throws with every error listed. */
export function parseDoc(raw: unknown): Doc {
  const { doc, issues } = validateDoc(raw)
  if (doc) return doc
  const errors = issues.filter((i) => i.level === 'error')
  const shown = errors.slice(0, 8).map(formatIssue)
  if (errors.length > shown.length) shown.push(`…and ${errors.length - shown.length} more`)
  throw new Error(`Not a valid Archipen file: ${shown.length === 1 ? shown[0] : '\n' + shown.map((s) => `- ${s}`).join('\n')}`)
}

/* ── Rules beyond the schema ──────────────────────────────────────────────── */

type Box = { x: number; y: number; w: number; d: number }
const overlapArea = (a: Box, b: Box) =>
  Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x)) * Math.max(0, Math.min(a.y + a.d, b.y + b.d) - Math.max(a.y, b.y))
const inside = (a: Box, b: Box) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.d <= b.y + b.d

export function checkDoc(doc: Doc): Issue[] {
  const issues: Issue[] = []
  const err = (path: string, message: string) => issues.push({ level: 'error', path, message })
  const warn = (path: string, message: string) => issues.push({ level: 'warning', path, message })

  // Unique page ids.
  const pageIds = new Set<string>()
  doc.pages.forEach((p, i) => {
    if (pageIds.has(p.id)) err(`pages[${i}].id`, `Duplicate page id "${p.id}". Page ids must be unique.`)
    pageIds.add(p.id)
  })

  // Unique item ids across every kind of item on every page.
  const kindOf = new Map<string, string>()
  doc.pages.forEach((page, pi) => {
    for (const [key, kind, items] of lists(page))
      items.forEach((it, i) => {
        if (kindOf.has(it.id))
          err(`pages[${pi}].${key}[${i}].id`, `Duplicate id "${it.id}" (already used by a ${kindOf.get(it.id)}). Ids must be unique across all items on all pages.`)
        else kindOf.set(it.id, kind)
      })
  })

  doc.pages.forEach((page, pi) => checkPage(doc, page, `pages[${pi}].`, err, warn))
  checkIcon(doc, 'settings.styles.node.icon', doc.settings.styles.node.icon, warn)
  return issues
}

type Report = (path: string, message: string) => void

const lists = (p: Page) =>
  [
    ['nodes', 'node', p.nodes],
    ['zones', 'zone', p.zones],
    ['edges', 'edge', p.edges],
    ['texts', 'text', p.texts],
  ] as const

function checkIcon(doc: Doc, path: string, ref: string | undefined, warn: Report) {
  if (!ref) return
  const [kind, name] = ref.split(':', 2)
  if (kind === 'lucide' && !LUCIDE_ICONS[name]) warn(path, `Unknown built-in icon "${name}"; nothing will be drawn. See the icon list in docs/file-format.md.`)
  if (kind === 'vendor' && !VENDOR_ICONS[name]) warn(path, `Unknown vendor icon "${name}"; nothing will be drawn. See the vendor icon list in docs/file-format.md.`)
  if (kind === 'custom' && !doc.assets[name]) warn(path, `No asset with id "${name}" in assets; nothing will be drawn.`)
}

function checkPage(doc: Doc, page: Page, at: string, err: Report, warn: Report) {
  // Wires connect existing nodes or zones on the same page, and the field says which.
  const kindHere = new Map<string, string>()
  for (const [, kind, items] of lists(page)) for (const it of items) kindHere.set(it.id, kind)
  page.edges.forEach((e, i) => {
    for (const end of ['from', 'to'] as const) {
      const want = e[end].zoneId !== undefined ? 'zone' : 'node'
      const id = endId(e[end])
      const kind = kindHere.get(id)
      if (kind === want) continue
      const path = `${at}edges[${i}].${end}.${want}Id`
      if (kind === 'node' || kind === 'zone') err(path, `"${id}" is a ${kind}; use "${kind}Id" instead of "${want}Id".`)
      else if (kind) err(path, `"${id}" is a ${kind}; wires connect nodes and zones only.`)
      else if (doc.pages.some((p) => p !== page && lists(p).some(([, , items]) => items.some((it) => it.id === id))))
        err(path, `"${id}" is on another page; wires connect items on the same page.`)
      else err(path, `No ${want} with id "${id}".`)
    }
  })

  // Links lead to another existing page.
  for (const [key, items] of [
    ['nodes', page.nodes],
    ['zones', page.zones],
  ] as const)
    items.forEach((it, i) => {
      if (!it.link) return
      const path = `${at}${key}[${i}].link.page`
      if (it.link.page === page.id) warn(path, `Links to its own page "${page.id}"; clicking it does nothing.`)
      else if (!doc.pages.some((p) => p.id === it.link!.page)) warn(path, `No page with id "${it.link.page}"; the link is ignored.`)
    })

  page.nodes.forEach((n, i) => checkIcon(doc, `${at}nodes[${i}].icon`, n.icon, warn))

  // Layout problems that make a diagram hard to read.
  const { nodes, zones } = page
  for (let i = 0; i < nodes.length; i++)
    for (let j = i + 1; j < nodes.length; j++)
      if (overlapArea(nodes[i], nodes[j]) > 0) warn(`${at}nodes[${j}]`, `Overlaps nodes[${i}] ("${nodes[i].name || nodes[i].id}").`)
  for (let i = 0; i < zones.length; i++)
    for (let j = i + 1; j < zones.length; j++) {
      const a = zones[i],
        b = zones[j]
      if (overlapArea(a, b) > 0 && !inside(a, b) && !inside(b, a))
        warn(`${at}zones[${j}]`, `Partly overlaps zones[${i}] ("${a.name || a.id}"). Zones should either nest completely or not touch.`)
    }
}
