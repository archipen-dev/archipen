import { newId } from './ids'
import { makePage } from './pages'
import { defaultSettings, defaultStyles, PALETTE, ZONE_PALETTE } from './constants'
import {
  FILE_VERSION,
  type DiagramNode,
  type Doc,
  type Edge,
  type EdgeData,
  type EntityKind,
  type LabelStyle,
  type NodeData,
  type PageDoc,
  type ResolvedDoc,
  type StyleDefaults,
  type TextData,
  type TextItem,
  type Zone,
  type ZoneData,
} from './schema'

export { defaultSettings, defaultStyles, EDGE_COLORS, NOTE_COLORS, PALETTE, ZONE_PALETTE } from './constants'
export { checkDoc, formatIssue, parseDoc, validateDoc, type Issue, type ValidationResult } from './parse'

export function emptyDoc(name = 'Untitled diagram'): Doc {
  return {
    format: 'archipen',
    version: FILE_VERSION,
    id: newId('d'),
    name,
    settings: defaultSettings(),
    pages: [makePage({ id: 'main', name: 'Main' })],
    assets: {},
  }
}

/** Create a node. Style fields are left unset so they follow the diagram defaults. */
export function makeNode(p: Partial<NodeData> & { x: number; y: number }, styles: StyleDefaults = defaultStyles()): NodeData {
  const t = styles.node
  return {
    id: newId('n'),
    name: 'Service',
    description: '',
    w: t.w,
    d: t.d,
    h: t.h,
    ...(t.icon ? { icon: t.icon } : {}),
    ...p,
  }
}

export function makeZone(p: Partial<ZoneData> & { x: number; y: number; w: number; d: number }): ZoneData {
  return { id: newId('z'), name: 'Zone', description: '', ...p }
}

export function makeEdge(p: Partial<EdgeData> & { from: EdgeData['from']; to: EdgeData['to'] }): EdgeData {
  return { id: newId('e'), name: '', description: '', waypoints: [], labelAt: 0.5, ...p }
}

export function makeText(p: Partial<TextData> & { x: number; y: number; kind: TextData['kind'] }, styles: StyleDefaults = defaultStyles()): TextData {
  const note = p.kind === 'note'
  return {
    id: newId('t'),
    name: note ? 'Note' : 'Text',
    description: '',
    w: styles.note.w,
    d: styles.note.d,
    ...p,
  }
}

/* ── Resolving styles ─────────────────────────────────────────────────────── */

const pick = <T extends object>(o: object, keys: readonly (keyof T)[]) => {
  const out: Partial<T> = {}
  for (const k of keys) {
    const v = (o as Partial<T>)[k]
    if (v !== undefined) out[k] = v
  }
  return out
}

export const resolveNode = (s: StyleDefaults, n: NodeData): DiagramNode => ({
  ...n,
  shape: n.shape ?? s.node.shape,
  color: n.color ?? s.node.color,
  outline: n.outline ?? s.node.outline,
  iconPlacement: n.iconPlacement ?? s.node.iconPlacement,
  iconScale: n.iconScale ?? s.node.iconScale,
  iconColor: n.iconColor ?? s.node.iconColor,
})

export const resolveZone = (s: StyleDefaults, z: ZoneData): Zone => ({ ...s.zone, ...pick<ZoneData>(z, Object.keys(z) as (keyof ZoneData)[]) }) as Zone

export const resolveEdge = (s: StyleDefaults, e: EdgeData): Edge => {
  const { flow, ...rest } = e
  return { ...s.edge, ...pick<EdgeData>(rest, Object.keys(rest) as (keyof EdgeData)[]), flow: { ...s.edge.flow, ...pick(flow ?? {}, ['enabled', 'direction', 'speed']) } } as Edge
}

export const resolveText = (s: StyleDefaults, t: TextData): TextItem => ({ ...t, color: t.kind === 'note' ? t.color || s.note.color : (t.color ?? s.text.color) })

const resolvedCache = new WeakMap<PageDoc, ResolvedDoc>()

/** The page with every item's style filled in from the defaults (memoised per page view). */
export function resolveDoc(doc: PageDoc): ResolvedDoc {
  let r = resolvedCache.get(doc)
  if (!r) {
    const s = doc.settings.styles
    r = {
      ...doc,
      nodes: doc.nodes.map((n) => resolveNode(s, n)),
      zones: doc.zones.map((z) => resolveZone(s, z)),
      edges: doc.edges.map((e) => resolveEdge(s, e)),
      texts: doc.texts.map((t) => resolveText(s, t)),
    }
    resolvedCache.set(doc, r)
  }
  return r
}

export function resolveLabel(doc: Pick<Doc, 'settings'>, kind: EntityKind, override?: Partial<LabelStyle>): LabelStyle {
  return { ...doc.settings.labelDefaults[kind], ...override }
}

export function sampleDoc(): Doc {
  const doc = emptyDoc('Sample architecture')
  const vpc = makeZone({ name: 'VPC', x: 3, y: -1, w: 12, d: 10 })
  const priv = makeZone({ name: 'Private subnet', x: 9, y: 0, w: 5, d: 8, color: ZONE_PALETTE[1], dashed: true, parentZoneId: vpc.id })
  const web = makeNode({ name: 'Browser', x: 0, y: 3, icon: 'lucide:monitor', color: PALETTE[7], shape: 'icon', iconPlacement: 'billboard' })
  const lb = makeNode({ name: 'Load balancer', x: 4, y: 3, icon: 'lucide:split', color: PALETTE[5], h: 0.6, zoneId: vpc.id })
  const api = makeNode({ name: 'API', description: 'REST + websockets', x: 10, y: 1, icon: 'lucide:server', zoneId: priv.id })
  const worker = makeNode({ name: 'Worker', x: 10, y: 5, icon: 'lucide:cpu', color: PALETTE[4], zoneId: priv.id })
  const db = makeNode({ name: 'Postgres', x: 16, y: 1, icon: 'lucide:database', shape: 'cylinder', color: PALETTE[1], h: 1.4 })
  const queue = makeNode({ name: 'Queue', x: 16, y: 5, icon: 'lucide:layers', color: PALETTE[2], h: 0.6 })
  const page = doc.pages[0]
  page.zones.push(vpc, priv)
  page.nodes.push(web, lb, api, worker, db, queue)
  page.edges.push(
    makeEdge({ name: 'HTTPS', from: { nodeId: web.id }, to: { nodeId: lb.id } }),
    makeEdge({ from: { nodeId: lb.id }, to: { nodeId: api.id } }),
    makeEdge({ name: 'SQL', from: { nodeId: api.id }, to: { nodeId: db.id }, arrows: 'both', flow: { direction: 'both', speed: 1.4 } }),
    makeEdge({ name: 'jobs', from: { nodeId: api.id }, to: { nodeId: queue.id }, color: '#d98a1c' }),
    makeEdge({ from: { nodeId: queue.id }, to: { nodeId: worker.id }, color: '#d98a1c' }),
    makeEdge({ from: { nodeId: worker.id }, to: { nodeId: db.id }, style: 'dashed', flow: { enabled: false } }),
  )
  page.texts.push(makeText({ kind: 'note', name: 'Deploys', description: 'Blue/green on every merge to main', x: 8, y: 10.5, w: 4, d: 2.5 }))
  return doc
}
