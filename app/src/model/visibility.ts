/*
 * Lock and hide. Items carry their own `locked` / `hidden` flags; a zone passes
 * its flag on to everything inside it, and a wire is hidden with either end.
 */
import { zoneDescendants } from './membership'
import { endId, type Layer } from './schema'

type Flag = 'locked' | 'hidden'

function flagged(doc: Layer, flag: Flag): Set<string> {
  const out = new Set<string>()
  for (const list of [doc.nodes, doc.zones, doc.edges, doc.texts]) for (const it of list) if (it[flag]) out.add(it.id)
  for (const z of doc.zones) if (z[flag]) for (const id of zoneDescendants(doc, z.id)) out.add(id)
  return out
}

/** Items that are hidden, directly or through a hidden zone or a hidden wire end. */
export function hiddenIds(doc: Layer): Set<string> {
  const out = flagged(doc, 'hidden')
  if (out.size) for (const e of doc.edges) if (out.has(endId(e.from)) || out.has(endId(e.to))) out.add(e.id)
  return out
}

/** Items that can't be moved or resized, directly or through a locked zone. */
export const lockedIds = (doc: Layer): Set<string> => flagged(doc, 'locked')

/** The document without hidden items, for drawing. Returns `doc` itself when nothing is hidden. */
export function withoutHidden<T extends Layer>(doc: T): T {
  const hidden = hiddenIds(doc)
  if (!hidden.size) return doc
  const keep = <T extends { id: string }>(list: T[]) => list.filter((it) => !hidden.has(it.id))
  return { ...doc, nodes: keep(doc.nodes), zones: keep(doc.zones), edges: keep(doc.edges), texts: keep(doc.texts) }
}

/** Items the user flagged themselves (not inherited), for the panel list. */
export function flaggedItems(doc: Layer): { id: string; kind: 'node' | 'zone' | 'edge' | 'text'; name: string; locked: boolean; hidden: boolean }[] {
  const lists = [
    ['zone', doc.zones],
    ['node', doc.nodes],
    ['text', doc.texts],
    ['edge', doc.edges],
  ] as const
  const out = []
  for (const [kind, list] of lists)
    for (const it of list) if (it.locked || it.hidden) out.push({ id: it.id, kind, name: it.name, locked: !!it.locked, hidden: !!it.hidden })
  return out
}
