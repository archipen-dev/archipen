import { endId, type Layer } from './schema'
import { zoneDescendants } from './membership'

/**
 * What to keep lit when presenting with `ids` selected: the items themselves,
 * their connections and whatever is on the other end. A zone brings its contents.
 */
export function focusSet(doc: Layer, ids: string[]): string[] {
  const out = new Set<string>()
  const nodes = new Set<string>()
  for (const id of ids) {
    out.add(id)
    if (doc.nodes.some((n) => n.id === id)) nodes.add(id)
    if (doc.zones.some((z) => z.id === id)) {
      nodes.add(id)
      for (const d of zoneDescendants(doc, id)) (out.add(d), nodes.add(d))
    }
    const e = doc.edges.find((x) => x.id === id)
    if (e) out.add(endId(e.from)).add(endId(e.to))
  }
  for (const e of doc.edges) {
    const a = nodes.has(endId(e.from)),
      b = nodes.has(endId(e.to))
    if (a || b) {
      out.add(e.id)
      out.add(endId(e.from)).add(endId(e.to))
    }
  }
  return [...out]
}
