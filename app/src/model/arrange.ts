/*
 * Align and distribute. Pure functions over grid positions: they return how far
 * each item should move and leave applying the move to the caller.
 */
import type { Layer } from './schema'

export type Axis = 'x' | 'y'
export type AlignTo = 'start' | 'center' | 'end'
export type ArrangeOp = { kind: 'align'; axis: Axis; to: AlignTo } | { kind: 'distribute'; axis: Axis }

/** Footprint of an item on the ground grid. Plain text is a point. */
export interface Footprint {
  id: string
  x: number
  y: number
  w: number
  d: number
}

/** Nodes, zones and texts in `ids`, minus any that sit inside another selected zone (they move with it). */
export function arrangeRoots(doc: Layer, ids: string[]): Footprint[] {
  const set = new Set(ids)
  const parentOf = new Map<string, string | undefined>()
  for (const z of doc.zones) parentOf.set(z.id, z.parentZoneId)
  for (const n of doc.nodes) parentOf.set(n.id, n.zoneId)
  for (const t of doc.texts) parentOf.set(t.id, t.zoneId)
  const insideSelectedZone = (id: string) => {
    const seen = new Set<string>()
    for (let p = parentOf.get(id); p && !seen.has(p); p = parentOf.get(p)) {
      if (set.has(p)) return true
      seen.add(p)
    }
    return false
  }
  const out: Footprint[] = []
  for (const id of ids) {
    if (insideSelectedZone(id)) continue
    const n = doc.nodes.find((x) => x.id === id) ?? doc.zones.find((x) => x.id === id)
    if (n) out.push({ id, x: n.x, y: n.y, w: n.w, d: n.d })
    const t = doc.texts.find((x) => x.id === id)
    if (t) out.push(t.kind === 'note' ? { id, x: t.x, y: t.y, w: t.w, d: t.d } : { id, x: t.x, y: t.y, w: 0, d: 0 })
  }
  return out
}

const start = (f: Footprint, a: Axis) => (a === 'x' ? f.x : f.y)
const size = (f: Footprint, a: Axis) => (a === 'x' ? f.w : f.d)
const clean = (v: number) => Math.round(v * 1e6) / 1e6

/** Move per item id, in grid units. Items that stay put are left out. */
export function arrangeDeltas(items: Footprint[], op: ArrangeOp): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>()
  const a = op.axis
  const put = (f: Footprint, target: number) => {
    const d = clean(target - start(f, a))
    if (d) out.set(f.id, a === 'x' ? { dx: d, dy: 0 } : { dx: 0, dy: d })
  }
  if (op.kind === 'align') {
    if (items.length < 2) return out
    const lo = Math.min(...items.map((f) => start(f, a)))
    const hi = Math.max(...items.map((f) => start(f, a) + size(f, a)))
    for (const f of items) {
      if (op.to === 'start') put(f, lo)
      else if (op.to === 'end') put(f, hi - size(f, a))
      else put(f, (lo + hi) / 2 - size(f, a) / 2)
    }
    return out
  }
  // distribute: keep the outermost items, make the gaps between neighbours equal
  if (items.length < 3) return out
  const sorted = [...items].sort((p, q) => start(p, a) + size(p, a) / 2 - (start(q, a) + size(q, a) / 2))
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const span = start(last, a) + size(last, a) - start(first, a)
  const gap = (span - sorted.reduce((s, f) => s + size(f, a), 0)) / (sorted.length - 1)
  let cursor = start(first, a)
  for (const f of sorted) {
    put(f, cursor)
    cursor += size(f, a) + gap
  }
  return out
}
