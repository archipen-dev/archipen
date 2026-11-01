import type { Vec2 } from './projection'
import type { Obstacle, RoutedEdge } from './routing'

/** Spacing between parallel wires that share a corridor, in grid units (≈9 px at 100%). */
export const LANE = 0.22
const SAME = 0.05

interface Seg {
  route: RoutedEdge
  /** Index of the segment's first point in `route.points`. */
  k: number
  horizontal: boolean
  at: number
  lo: number
  hi: number
  /** Where the wire comes from / goes to on the perpendicular axis, for lane ordering. */
  side: number
}

function blocked(a: Vec2, b: Vec2, obstacles: Obstacle[]): boolean {
  const e = 1e-6
  if (Math.abs(a.y - b.y) < e) {
    const lo = Math.min(a.x, b.x),
      hi = Math.max(a.x, b.x)
    return obstacles.some((o) => a.y > o.y0 + e && a.y < o.y1 - e && Math.max(lo, o.x0) < Math.min(hi, o.x1) - e)
  }
  const lo = Math.min(a.y, b.y),
    hi = Math.max(a.y, b.y)
  return obstacles.some((o) => a.x > o.x0 + e && a.x < o.x1 - e && Math.max(lo, o.y0) < Math.min(hi, o.y1) - e)
}

/**
 * Spread wires that run along the same line into parallel lanes, so overlapping
 * wires stay readable. Port stubs (first/last segment) are left alone since the
 * router already spreads wires along a node side. Mutates the routes' points.
 */
export function separateLanes(routes: Iterable<RoutedEdge>, obstacles: Obstacle[]): void {
  const segs: Seg[] = []
  for (const route of routes) {
    const p = route.points
    for (let k = 1; k < p.length - 2; k++) {
      const a = p[k],
        b = p[k + 1]
      const horizontal = Math.abs(a.y - b.y) < 1e-6
      if (!horizontal && Math.abs(a.x - b.x) > 1e-6) continue
      const before = p[k - 1],
        after = p[k + 2]
      // Lower-coordinate end first, so "side" compares like with like.
      const first = horizontal ? (a.x <= b.x ? before : after) : a.y <= b.y ? before : after
      const last = first === before ? after : before
      const at = horizontal ? a.y : a.x
      const coord = (q: Vec2) => (horizontal ? q.y : q.x) - at
      segs.push({
        route,
        k,
        horizontal,
        at,
        lo: horizontal ? Math.min(a.x, b.x) : Math.min(a.y, b.y),
        hi: horizontal ? Math.max(a.x, b.x) : Math.max(a.y, b.y),
        side: Math.sign(coord(first)) * 2 + Math.sign(coord(last)),
      })
    }
  }

  // Cluster collinear segments that overlap.
  segs.sort((s, t) => Number(s.horizontal) - Number(t.horizontal) || s.at - t.at || s.lo - t.lo)
  const clusters: Seg[][] = []
  let cur: Seg[] = []
  let reach = -Infinity
  for (const s of segs) {
    const head = cur[0]
    if (head && head.horizontal === s.horizontal && Math.abs(head.at - s.at) < SAME && s.lo < reach - SAME) {
      cur.push(s)
      reach = Math.max(reach, s.hi)
    } else {
      if (cur.length > 1) clusters.push(cur)
      cur = [s]
      reach = s.hi
    }
  }
  if (cur.length > 1) clusters.push(cur)

  // Shift each wire in a cluster onto its own lane, shrinking lanes where a block is close.
  const shifts: { s: Seg; off: number }[] = []
  for (const cluster of clusters) {
    if (new Set(cluster.map((c) => c.route)).size < 2) continue
    cluster.sort((s, t) => s.side - t.side)
    const n = cluster.length
    let lane = LANE
    for (let attempt = 0; attempt < 4; attempt++, lane /= 2) {
      const offs = cluster.map((_, i) => (i - (n - 1) / 2) * lane)
      const ok = cluster.every((s, i) => {
        const a = s.horizontal ? { x: s.lo, y: s.at + offs[i] } : { x: s.at + offs[i], y: s.lo }
        const b = s.horizontal ? { x: s.hi, y: s.at + offs[i] } : { x: s.at + offs[i], y: s.hi }
        return !blocked(a, b, obstacles)
      })
      if (ok) {
        cluster.forEach((s, i) => shifts.push({ s, off: offs[i] }))
        break
      }
    }
  }
  for (const { s, off } of shifts) {
    const p = s.route.points
    for (const q of [p[s.k], p[s.k + 1]]) {
      if (s.horizontal) q.y = s.at + off
      else q.x = s.at + off
    }
  }
}
