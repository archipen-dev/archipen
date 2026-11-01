import { endId } from '../model/schema'
import { labelCorners } from './labels'
import type { Vec2 } from './projection'
import type { Scene } from './scene'
import { boundsOf, convexHull, rectContains, rectsIntersect, unionRect, type Rect } from './shapes'

export type Outline = { kind: 'poly'; points: Vec2[] } | { kind: 'path'; d: string; width: number }

/** Selection/hover outline of an entity in scene px. */
export function entityOutline(scene: Scene, id: string): Outline | null {
  const n = scene.nodes.find((x) => x.node.id === id)
  if (n) return { kind: 'poly', points: convexHull(n.outline) }
  const z = scene.zones.find((x) => x.zone.id === id)
  if (z) return { kind: 'poly', points: z.poly }
  const e = scene.edges.find((x) => x.edge.id === id)
  if (e) return { kind: 'path', d: e.plainD, width: e.edge.width }
  const t = scene.texts.find((x) => x.text.id === id)
  if (t) {
    if (t.poly) return { kind: 'poly', points: t.poly }
    if (t.label) return { kind: 'poly', points: pad(labelCorners(t.label), 4) }
    return { kind: 'poly', points: [t.anchor, { x: t.anchor.x + 1, y: t.anchor.y + 1 }] }
  }
  return null
}

function pad(poly: Vec2[], by: number): Vec2[] {
  const c = poly.reduce((a, p) => ({ x: a.x + p.x / poly.length, y: a.y + p.y / poly.length }), { x: 0, y: 0 })
  return poly.map((p) => {
    const dx = p.x - c.x,
      dy = p.y - c.y
    const l = Math.hypot(dx, dy) || 1
    return { x: p.x + (dx / l) * by, y: p.y + (dy / l) * by }
  })
}

/** Screen bounds of an entity (shape + label). */
export function entityBounds(scene: Scene, id: string): Rect | null {
  let r: Rect | null = null
  const n = scene.nodes.find((x) => x.node.id === id)
  if (n) {
    r = boundsOf(n.outline)
    if (n.label) r = unionRect(r, boundsOf(labelCorners(n.label)))
    return r
  }
  const z = scene.zones.find((x) => x.zone.id === id)
  if (z) return boundsOf(z.poly)
  const e = scene.edges.find((x) => x.edge.id === id)
  if (e) return e.screen.length ? boundsOf(e.screen) : null
  const t = scene.texts.find((x) => x.text.id === id)
  if (t) {
    if (t.poly) r = boundsOf(t.poly)
    if (t.label) r = unionRect(r, boundsOf(labelCorners(t.label)))
    return r ?? { x: t.anchor.x, y: t.anchor.y, w: 1, h: 1 }
  }
  return null
}

export function boundsOfIds(scene: Scene, ids: string[]): Rect | null {
  let r: Rect | null = null
  for (const id of ids) {
    const b = entityBounds(scene, id)
    if (b) r = unionRect(r, b)
  }
  return r
}

/** Ids picked by a marquee rectangle (scene px). */
export function marqueeHits(scene: Scene, m: Rect): string[] {
  const out: string[] = []
  const nodeHit = new Set<string>()
  for (const n of scene.nodes) {
    if (rectsIntersect(m, boundsOf(n.outline))) {
      out.push(n.node.id)
      nodeHit.add(n.node.id)
    }
  }
  for (const z of scene.zones) if (rectContains(m, boundsOf(z.poly))) (out.push(z.zone.id), nodeHit.add(z.zone.id))
  for (const t of scene.texts) {
    const b = entityBounds(scene, t.text.id)
    if (b && rectsIntersect(m, b)) out.push(t.text.id)
  }
  for (const e of scene.edges) if (nodeHit.has(endId(e.edge.from)) && nodeHit.has(endId(e.edge.to))) out.push(e.edge.id)
  return out
}
