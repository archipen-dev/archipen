import type { Vec2 } from './projection'

export type CrossingStyle = 'hop' | 'gap' | 'none'

export interface Crossing {
  seg: number
  /** Distance from the segment start, in px. */
  dist: number
  point: Vec2
}

/** Proper intersection of segments p1-p2 and p3-p4 (excludes touching ends). */
export function segmentIntersection(p1: Vec2, p2: Vec2, p3: Vec2, p4: Vec2, eps = 1e-6): { t: number; u: number; point: Vec2 } | null {
  const d1x = p2.x - p1.x,
    d1y = p2.y - p1.y
  const d2x = p4.x - p3.x,
    d2y = p4.y - p3.y
  const den = d1x * d2y - d1y * d2x
  if (Math.abs(den) < 1e-9) return null // parallel / collinear
  const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / den
  const u = ((p3.x - p1.x) * d1y - (p3.y - p1.y) * d1x) / den
  if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null
  return { t, u, point: { x: p1.x + d1x * t, y: p1.y + d1y * t } }
}

function bbox(pts: Vec2[]) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity
  for (const p of pts) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  return { x0, y0, x1, y1 }
}

/**
 * For each polyline (screen space, in draw order) find where it crosses any
 * polyline drawn before it. The later one is the one that hops / breaks.
 */
export function findCrossings(lines: Vec2[][]): Crossing[][] {
  const boxes = lines.map(bbox)
  return lines.map((line, i) => {
    const out: Crossing[] = []
    for (let j = 0; j < i; j++) {
      const a = boxes[i],
        b = boxes[j]
      if (a.x1 < b.x0 || b.x1 < a.x0 || a.y1 < b.y0 || b.y1 < a.y0) continue
      const other = lines[j]
      for (let s = 0; s < line.length - 1; s++) {
        for (let k = 0; k < other.length - 1; k++) {
          const hit = segmentIntersection(line[s], line[s + 1], other[k], other[k + 1])
          if (hit) {
            const len = Math.hypot(line[s + 1].x - line[s].x, line[s + 1].y - line[s].y)
            out.push({ seg: s, dist: hit.t * len, point: hit.point })
          }
        }
      }
    }
    return out.sort((p, q) => p.seg - q.seg || p.dist - q.dist)
  })
}

const f = (n: number) => Math.round(n * 100) / 100

/**
 * SVG path for a polyline, with a hop (semicircle) or a gap at each crossing.
 * Hops always bulge towards the top of the screen (or left for vertical runs).
 */
export function polylinePath(pts: Vec2[], crossings: Crossing[], style: CrossingStyle, r = 6): string {
  if (pts.length === 0) return ''
  let d = `M${f(pts[0].x)} ${f(pts[0].y)}`
  for (let s = 0; s < pts.length - 1; s++) {
    const a = pts[s],
      b = pts[s + 1]
    const len = Math.hypot(b.x - a.x, b.y - a.y)
    if (len === 0) continue
    const ux = (b.x - a.x) / len,
      uy = (b.y - a.y) / len
    let cursor = 0
    if (style !== 'none') {
      for (const c of crossings) {
        if (c.seg !== s) continue
        // skip crossings too close to a corner or the previous hop
        if (c.dist - r < cursor + 1 || c.dist + r > len - 1) continue
        const p1 = { x: a.x + ux * (c.dist - r), y: a.y + uy * (c.dist - r) }
        const p2 = { x: a.x + ux * (c.dist + r), y: a.y + uy * (c.dist + r) }
        d += ` L${f(p1.x)} ${f(p1.y)}`
        if (style === 'hop') {
          // left-hand normal (screen, y down) is (uy, -ux); sweep=1 bulges that way
          const nY = -ux,
            nX = uy
          const bulgeLeft = Math.abs(nY) > 1e-3 ? nY < 0 : nX < 0
          d += ` A${r} ${r} 0 0 ${bulgeLeft ? 1 : 0} ${f(p2.x)} ${f(p2.y)}`
        } else {
          d += ` M${f(p2.x)} ${f(p2.y)}`
        }
        cursor = c.dist + r
      }
    }
    d += ` L${f(b.x)} ${f(b.y)}`
  }
  return d
}

export function polylineLength(pts: Vec2[]): number {
  let l = 0
  for (let i = 0; i < pts.length - 1; i++) l += Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
  return l
}

/** Point and segment index at fraction `t` (0..1) along a polyline. */
export function pointAlong(pts: Vec2[], t: number): { point: Vec2; seg: number } {
  const total = polylineLength(pts)
  let target = total * t
  for (let i = 0; i < pts.length - 1; i++) {
    const l = Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y)
    if (target <= l || i === pts.length - 2) {
      const k = l === 0 ? 0 : Math.min(1, target / l)
      return { point: { x: pts[i].x + (pts[i + 1].x - pts[i].x) * k, y: pts[i].y + (pts[i + 1].y - pts[i].y) * k }, seg: i }
    }
    target -= l
  }
  return { point: pts[0], seg: 0 }
}
