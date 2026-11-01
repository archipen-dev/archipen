/*
 * Copy, cut, paste and duplicate. The clipboard lives in memory for this tab;
 * a JSON copy also goes to the system clipboard so other tabs could read it later.
 */
import { newId } from '../model/ids'
import { recomputeMembership } from '../model/membership'
import { movableSet } from '../model/ops'
import { endId, type Asset, type EdgeData, type Endpoint, type NodeData, type PageDoc, type TextData, type ZoneData } from '../model/schema'
import { getPage } from '../store/selectors'
import { deleteIds } from './edit'
import { mutatePage } from './mutate'

interface ClipPayload {
  nodes: NodeData[]
  zones: ZoneData[]
  edges: EdgeData[]
  texts: TextData[]
  /** Custom icons the nodes use, so they survive a paste into another diagram. */
  assets: Record<string, Asset>
}

let clipboard: ClipPayload | null = null

/** The items `ids` stand for, with zone contents and the wires between them. */
function collect(doc: PageDoc, ids: string[]): ClipPayload {
  const set = movableSet(doc, ids)
  const nodes = doc.nodes.filter((n) => set.has(n.id))
  const zones = doc.zones.filter((z) => set.has(z.id))
  const ends = new Set([...nodes, ...zones].map((n) => n.id))
  const assets: Record<string, Asset> = {}
  for (const n of nodes) {
    const id = n.icon?.startsWith('custom:') ? n.icon.slice('custom:'.length) : ''
    if (id && doc.assets[id]) assets[id] = doc.assets[id]
  }
  return { assets, nodes, zones, texts: doc.texts.filter((t) => set.has(t.id)), edges: doc.edges.filter((e) => ends.has(endId(e.from)) && ends.has(endId(e.to))) }
}

/** A copy of `c` with fresh ids, moved by `offset`. */
function cloneShifted(c: ClipPayload, offset: number): ClipPayload {
  const ids = new Map<string, string>()
  const remap = (id: string) => {
    if (!ids.has(id)) ids.set(id, newId(id[0]))
    return ids.get(id)!
  }
  const remapEnd = (end: Endpoint): Endpoint => (end.zoneId !== undefined ? { ...end, zoneId: remap(end.zoneId) } : { ...end, nodeId: remap(endId(end)) })
  const shift = <T extends { id: string; x: number; y: number }>(it: T): T => ({ ...it, id: remap(it.id), x: it.x + offset, y: it.y + offset })
  return {
    assets: c.assets,
    nodes: c.nodes.map(shift),
    zones: c.zones.map(shift),
    texts: c.texts.map(shift),
    edges: c.edges.map((e) => ({
      ...e,
      id: remap(e.id),
      from: remapEnd(e.from),
      to: remapEnd(e.to),
      waypoints: e.waypoints.map((w) => ({ x: w.x + offset, y: w.y + offset })),
    })),
  }
}

function insert(c: ClipPayload): string[] {
  mutatePage((p, d) => {
    // An icon already in the diagram under the same id is kept as it is.
    for (const [id, asset] of Object.entries(c.assets)) d.assets[id] ??= asset
    // Links to pages this diagram doesn't have (pasted from another one) are dropped.
    const pages = new Set(d.pages.map((x) => x.id))
    const keepLink = <T extends NodeData | ZoneData>(it: T): T => {
      if (!it.link || pages.has(it.link.page)) return it
      const { link: _link, ...rest } = it
      return rest as T
    }
    p.zones.push(...c.zones.map(keepLink))
    p.nodes.push(...c.nodes.map(keepLink))
    p.texts.push(...c.texts)
    p.edges.push(...c.edges)
    recomputeMembership(p)
  })
  return [...c.zones, ...c.nodes, ...c.texts].map((x) => x.id)
}

export function copy(ids: string[]) {
  const doc = getPage()
  if (!doc || !ids.length) return
  clipboard = collect(doc, ids)
  try {
    navigator.clipboard?.writeText(JSON.stringify({ archipenClip: clipboard })).catch(() => {})
  } catch {
    /* clipboard unavailable */
  }
}

export function cut(ids: string[]) {
  copy(ids)
  deleteIds(ids)
}

/** Paste a shifted copy; each paste lands a little further away. Returns the new ids. */
export function paste(offset = 1): string[] {
  if (!clipboard) return []
  const pasted = cloneShifted(clipboard, offset)
  clipboard = pasted
  return insert(pasted)
}

/** Copy `ids` in place (shifted by one), leaving the clipboard alone. */
export function duplicate(ids: string[]): string[] {
  const doc = getPage()
  if (!doc || !ids.length) return []
  return insert(cloneShifted(collect(doc, ids), 1))
}
