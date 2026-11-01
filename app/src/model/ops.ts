/*
 * Pure draft recipes shared by commands and canvas gestures.
 */
import type { Draft } from 'immer'
import { findBox } from './entities'
import { zoneDescendants } from './membership'
import { endId, type Layer } from './schema'

type Vec2 = { x: number; y: number }
const center = (b: { x: number; y: number; w: number; d: number }) => ({ x: b.x + b.w / 2, y: b.y + b.d / 2 })

/** Ids that move together when `ids` are dragged: zones bring their contents. */
export function movableSet(doc: Layer, ids: Iterable<string>): Set<string> {
  const out = new Set<string>()
  for (const id of ids) {
    out.add(id)
    if (doc.zones.some((z) => z.id === id)) for (const x of zoneDescendants(doc, id)) out.add(x)
  }
  return out
}

/** Move entities by a world delta, starting from their positions in `base`. */
export function applyMove(d: Draft<Layer>, base: Layer, ids: Set<string>, dx: number, dy: number) {
  const shift = <T extends { id: string; x: number; y: number }>(list: Draft<T>[], from: T[]) => {
    for (const it of list) {
      if (!ids.has(it.id)) continue
      const b = from.find((x) => x.id === it.id)
      if (b) ((it.x = b.x + dx), (it.y = b.y + dy))
    }
  }
  shift(d.nodes, base.nodes)
  shift(d.zones, base.zones)
  shift(d.texts, base.texts)
  for (const e of d.edges) {
    const both = ids.has(endId(e.from)) && ids.has(endId(e.to))
    if (!both && !ids.has(e.id)) continue
    const b = base.edges.find((x) => x.id === e.id)
    if (b) e.waypoints = b.waypoints.map((w) => ({ x: w.x + dx, y: w.y + dy }))
  }
}

/** Remove items and every wire left without an end. */
export function removeItems(d: Draft<Layer>, ids: Set<string>) {
  d.nodes = d.nodes.filter((n) => !ids.has(n.id))
  d.zones = d.zones.filter((z) => !ids.has(z.id))
  d.texts = d.texts.filter((t) => !ids.has(t.id))
  const alive = new Set([...d.nodes, ...d.zones].map((n) => n.id))
  d.edges = d.edges.filter((e) => !ids.has(e.id) && alive.has(endId(e.from)) && alive.has(endId(e.to)))
}

/** Insert a bend at `pt` into the wire segment it is closest to. */
export function insertWaypoint(d: Draft<Layer>, edgeId: string, pt: Vec2) {
  const edge = d.edges.find((x) => x.id === edgeId)
  if (!edge) return
  const from = findBox(d as Layer, endId(edge.from))
  const to = findBox(d as Layer, endId(edge.to))
  if (!from || !to) return
  const anchors = [center(from), ...edge.waypoints, center(to)]
  let best = 0
  let bestDetour = Infinity
  for (let i = 0; i < anchors.length - 1; i++) {
    const a = anchors[i]
    const b = anchors[i + 1]
    const detour = Math.hypot(pt.x - a.x, pt.y - a.y) + Math.hypot(b.x - pt.x, b.y - pt.y) - Math.hypot(b.x - a.x, b.y - a.y)
    if (detour < bestDetour) ((bestDetour = detour), (best = i))
  }
  edge.waypoints.splice(best, 0, pt)
}
