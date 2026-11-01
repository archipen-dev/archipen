import type { DiagramNode, Port, TextItem, Zone } from '../model/schema'
import { project, type Projection, type Vec2 } from './projection'

export interface Box {
  x: number
  y: number
  w: number
  d: number
  h: number
}

export const nodeBox = (n: DiagramNode): Box => ({ x: n.x, y: n.y, w: n.w, d: n.d, h: n.shape === 'flat' ? 0.08 : n.shape === 'icon' ? 0 : n.h })
export const zoneBox = (z: Pick<Zone, 'x' | 'y' | 'w' | 'd'>): Box => ({ x: z.x, y: z.y, w: z.w, d: z.d, h: 0 })
export const noteBox = (t: TextItem): Box => ({ x: t.x, y: t.y, w: t.w, d: t.d, h: 0.05 })

export const toPoints = (pts: Vec2[]) => pts.map((p) => `${round(p.x)},${round(p.y)}`).join(' ')
export const round = (n: number) => Math.round(n * 100) / 100

/** The 4 corners of a horizontal rectangle at height z, clockwise from (x,y). */
export function rectAt(b: Box, z: number, p: Projection): Vec2[] {
  return [
    project(b.x, b.y, z, p),
    project(b.x + b.w, b.y, z, p),
    project(b.x + b.w, b.y + b.d, z, p),
    project(b.x, b.y + b.d, z, p),
  ]
}

export interface BlockFaces {
  top: Vec2[]
  /** Face at y = y+d (visible lower-left in iso). */
  left: Vec2[]
  /** Face at x = x+w (visible lower-right in iso). */
  right: Vec2[]
}

export function blockFaces(b: Box, p: Projection): BlockFaces {
  const P = (x: number, y: number, z: number) => project(x, y, z, p)
  const { x, y, w, d, h } = b
  return {
    top: rectAt(b, h, p),
    left: [P(x, y + d, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x, y + d, h)],
    right: [P(x + w, y, 0), P(x + w, y + d, 0), P(x + w, y + d, h), P(x + w, y, h)],
  }
}

/** All 8 projected corners; useful for bounds and label placement. */
export function boxCorners(b: Box, p: Projection): Vec2[] {
  return [...rectAt(b, 0, p), ...rectAt(b, b.h, p)]
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}

export function boundsOf(pts: Vec2[]): Rect {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity
  for (const q of pts) {
    if (q.x < minX) minX = q.x
    if (q.y < minY) minY = q.y
    if (q.x > maxX) maxX = q.x
    if (q.y > maxY) maxY = q.y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

export function unionRect(a: Rect | null, b: Rect): Rect {
  if (!a) return b
  const x = Math.min(a.x, b.x)
  const y = Math.min(a.y, b.y)
  return { x, y, w: Math.max(a.x + a.w, b.x + b.w) - x, h: Math.max(a.y + a.h, b.y + b.h) - y }
}

export const rectsIntersect = (a: Rect, b: Rect) => a.x <= b.x + b.w && b.x <= a.x + a.w && a.y <= b.y + b.h && b.y <= a.y + a.h
export const rectContains = (outer: Rect, inner: Rect) =>
  inner.x >= outer.x && inner.y >= outer.y && inner.x + inner.w <= outer.x + outer.w && inner.y + inner.h <= outer.y + outer.h

/** Convex silhouette of a box in screen space (hexagon in iso, rect in 2D). */
export function silhouette(b: Box, p: Projection): Vec2[] {
  if (p === '2d') return rectAt(b, 0, p)
  const P = (x: number, y: number, z: number) => project(x, y, z, p)
  const { x, y, w, d, h } = b
  // top-back, top-right, bottom-right, bottom-front, bottom-left, top-left
  return [P(x, y, h), P(x + w, y, h), P(x + w, y, 0), P(x + w, y + d, 0), P(x, y + d, 0), P(x, y + d, h)]
}

export const PORT_NORMALS: Record<Port, Vec2> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
}

/** World-space point on the given side of a box, `t` in 0..1 along the side. */
export function portPoint(b: Box, port: Port, t = 0.5): Vec2 {
  switch (port) {
    case 'n':
      return { x: b.x + b.w * t, y: b.y }
    case 's':
      return { x: b.x + b.w * t, y: b.y + b.d }
    case 'w':
      return { x: b.x, y: b.y + b.d * t }
    case 'e':
      return { x: b.x + b.w, y: b.y + b.d * t }
  }
}

/** Painter's order key: larger = closer to the viewer in iso. */
export const depthKey = (b: Box) => b.x + b.w / 2 + (b.y + b.d / 2)

export const center = (b: { x: number; y: number; w: number; d: number }) => ({ x: b.x + b.w / 2, y: b.y + b.d / 2 })

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.replace('#', '').padEnd(6, '0').slice(0, 6), 16)
  if (Number.isNaN(n)) return hex
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255
  if (amount >= 0) {
    r += (255 - r) * amount
    g += (255 - g) * amount
    b += (255 - b) * amount
  } else {
    r *= 1 + amount
    g *= 1 + amount
    b *= 1 + amount
  }
  const h = (v: number) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

export function pointInPolygon(pt: Vec2, poly: Vec2[]): boolean {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      c = poly[j]
    if (a.y > pt.y !== c.y > pt.y && pt.x < ((c.x - a.x) * (pt.y - a.y)) / (c.y - a.y) + a.x) inside = !inside
  }
  return inside
}

/** Convex hull (monotone chain), clockwise in screen space. */
export function convexHull(points: Vec2[]): Vec2[] {
  const pts = [...points].sort((a, b) => a.x - b.x || a.y - b.y)
  if (pts.length <= 2) return pts
  const cross = (o: Vec2, a: Vec2, b: Vec2) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)
  const lower: Vec2[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper: Vec2[] = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  upper.pop()
  lower.pop()
  return lower.concat(upper)
}
