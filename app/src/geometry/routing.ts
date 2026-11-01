import { endId, type DiagramNode, type EdgeData, type Port, type ZoneData } from '../model/schema'
import { separateLanes } from './nudge'
import type { Vec2 } from './projection'
import { center, nodeBox, PORT_NORMALS, portPoint, zoneBox, type Box } from './shapes'

/** How far a wire leaves a node straight out of its port before turning. */
export const STUB = 0.6

export interface RoutedEdge {
  id: string
  /** World-space polyline (grid units, ground plane). */
  points: Vec2[]
  fromPort: Port
  toPort: Port
}

export function autoPort(from: Vec2, toward: Vec2, nodeW: number, nodeD: number): Port {
  const dx = (toward.x - from.x) / Math.max(nodeW, 0.01)
  const dy = (toward.y - from.y) / Math.max(nodeD, 0.01)
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 'e' : 'w'
  return dy >= 0 ? 's' : 'n'
}

const isHorizontal = (h: Vec2) => Math.abs(h.x) > Math.abs(h.y)
const eq = (a: number, b: number) => Math.abs(a - b) < 1e-6

/** Corner points that join `a` (moving along heading `ha`) to `b`, optionally arriving along `hb`. */
export function connect(a: Vec2, ha: Vec2, b: Vec2, hb?: Vec2): Vec2[] {
  if (eq(a.x, b.x) || eq(a.y, b.y)) return []
  const aH = isHorizontal(ha)
  if (!hb) return aH ? [{ x: b.x, y: a.y }] : [{ x: a.x, y: b.y }]
  const bH = isHorizontal(hb)
  if (aH && bH) {
    const mx = (a.x + b.x) / 2
    return [
      { x: mx, y: a.y },
      { x: mx, y: b.y },
    ]
  }
  if (!aH && !bH) {
    const my = (a.y + b.y) / 2
    return [
      { x: a.x, y: my },
      { x: b.x, y: my },
    ]
  }
  return aH ? [{ x: b.x, y: a.y }] : [{ x: a.x, y: b.y }]
}

/** Drop repeated points and middle points of straight runs. */
export function simplify(pts: Vec2[]): Vec2[] {
  const out: Vec2[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && eq(last.x, p.x) && eq(last.y, p.y)) continue
    out.push(p)
  }
  for (let i = out.length - 2; i >= 1; i--) {
    const a = out[i - 1],
      b = out[i],
      c = out[i + 1]
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x)
    const dot = (b.x - a.x) * (c.x - b.x) + (b.y - a.y) * (c.y - b.y)
    if (Math.abs(cross) < 1e-9 && dot >= 0) out.splice(i, 1)
  }
  return out
}

/* ── Obstacle-avoiding search ────────────────────────────────────────────── */

/** Clearance kept between wires and blocks they pass, in grid units. */
export const CLEAR = 0.35
const BEND = 1.2
const SHARED = 0.3
const MAX_EXPANSIONS = 6000

/** Axis-aligned rectangle (inflated node footprint). Its interior is blocked; its border is free. */
export interface Obstacle {
  x0: number
  y0: number
  x1: number
  y1: number
}

/** A straight wire segment already placed, used to discourage sharing a corridor. */
export interface Track {
  horizontal: boolean
  /** y for horizontal tracks, x for vertical. */
  at: number
  lo: number
  hi: number
}

const dirIndex = (h: Vec2) => (Math.abs(h.x) >= Math.abs(h.y) ? (h.x >= 0 ? 0 : 2) : h.y >= 0 ? 1 : 3)

const inside = (o: Obstacle, p: Vec2) => p.x > o.x0 + 1e-6 && p.x < o.x1 - 1e-6 && p.y > o.y0 + 1e-6 && p.y < o.y1 - 1e-6

/** True when the axis-aligned segment a→b passes through an obstacle's interior. */
export function segmentBlocked(a: Vec2, b: Vec2, obstacles: Obstacle[]): boolean {
  const e = 1e-6
  if (eq(a.y, b.y)) {
    const lo = Math.min(a.x, b.x),
      hi = Math.max(a.x, b.x)
    return obstacles.some((o) => a.y > o.y0 + e && a.y < o.y1 - e && Math.max(lo, o.x0) < Math.min(hi, o.x1) - e)
  }
  const lo = Math.min(a.y, b.y),
    hi = Math.max(a.y, b.y)
  return obstacles.some((o) => a.x > o.x0 + e && a.x < o.x1 - e && Math.max(lo, o.y0) < Math.min(hi, o.y1) - e)
}

/** Tracks closer than this count as the same corridor. */
const SAME_TRACK = 0.05
/** Bucket size of the track index; larger than SAME_TRACK, so a lookup only needs the neighbouring buckets. */
const BUCKET = 0.1

type Indexed = { t: Track; seq: number }

/** Placed wire segments, bucketed by line so a lookup doesn't scan every wire. */
export class TrackIndex {
  private readonly h = new Map<number, Indexed[]>()
  private readonly v = new Map<number, Indexed[]>()
  size = 0

  constructor(tracks: Iterable<Track> = []) {
    for (const t of tracks) this.add(t)
  }

  add(t: Track) {
    const map = t.horizontal ? this.h : this.v
    const k = Math.floor(t.at / BUCKET)
    const list = map.get(k)
    const item = { t, seq: this.size++ }
    if (list) list.push(item)
    else map.set(k, [item])
  }

  /** Total length of placed tracks running along the same line as the span lo..hi at `at`. */
  shared(horizontal: boolean, at: number, lo: number, hi: number): number {
    const map = horizontal ? this.h : this.v
    const k = Math.floor(at / BUCKET)
    const a = map.get(k - 1),
      b = map.get(k),
      c = map.get(k + 1)
    if (!a && !b && !c) return 0
    // Sum in insertion order, like a plain scan would: the result is then bit-for-bit the same.
    const lists = [a, b, c].filter((l) => l !== undefined)
    const items = lists.length === 1 ? lists[0] : lists.flat().sort((p, q) => p.seq - q.seq)
    let sum = 0
    for (const { t } of items) {
      if (Math.abs(t.at - at) > SAME_TRACK) continue
      const ov = Math.min(hi, t.hi) - Math.max(lo, t.lo)
      if (ov > 0) sum += ov
    }
    return sum
  }
}

/** First index in sorted `v` whose value is greater than `x`. */
function upperBound(v: number[], x: number): number {
  let lo = 0,
    hi = v.length
  while (lo < hi) {
    const m = (lo + hi) >> 1
    if (v[m] <= x) lo = m + 1
    else hi = m
  }
  return lo
}

class Heap<T> {
  private items: { k: number; v: T }[] = []
  get size() {
    return this.items.length
  }
  push(k: number, v: T) {
    const a = this.items
    a.push({ k, v })
    let i = a.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (a[p].k <= a[i].k) break
      ;[a[p], a[i]] = [a[i], a[p]]
      i = p
    }
  }
  pop(): T {
    const a = this.items
    const top = a[0]
    const last = a.pop()!
    if (a.length) {
      a[0] = last
      let i = 0
      for (;;) {
        const l = i * 2 + 1,
          r = l + 1
        let m = i
        if (l < a.length && a[l].k < a[m].k) m = l
        if (r < a.length && a[r].k < a[m].k) m = r
        if (m === i) break
        ;[a[m], a[i]] = [a[i], a[m]]
        i = m
      }
    }
    return top.v
  }
}

const uniqSorted = (v: number[]) => {
  v.sort((p, q) => p - q)
  const out: number[] = []
  for (const x of v) if (!out.length || Math.abs(out[out.length - 1] - x) > 1e-6) out.push(x)
  return out
}

/**
 * Orthogonal path from `a` (leaving along `ha`) to `b` (arriving along `hb` if given)
 * that avoids obstacle interiors. Returns the corner points between a and b,
 * or null when no path was found within the search budget.
 */
export function searchLeg(a: Vec2, ha: Vec2, b: Vec2, hb: Vec2 | undefined, allObstacles: Obstacle[], placed: Track[] | TrackIndex = []): Vec2[] | null {
  const tracks = placed instanceof TrackIndex ? placed : new TrackIndex(placed)
  // Ignore obstacles that contain an endpoint (e.g. a waypoint dropped on a block).
  const obstacles = allObstacles.filter((o) => !inside(o, a) && !inside(o, b))
  if (!segmentBlocked(a, b, obstacles) && (eq(a.x, b.x) || eq(a.y, b.y))) {
    const d = dirIndex({ x: b.x - a.x, y: b.y - a.y })
    // Straight shot that doesn't double back: no corners needed.
    if ((a.x !== b.x || a.y !== b.y) && d === dirIndex(ha) && (!hb || d === dirIndex(hb))) return []
  }

  // Sparse grid: obstacle borders, corridor centres, endpoints and a frame around everything nearby.
  const PAD = 1.5
  const minX = Math.min(a.x, b.x) - PAD - 4,
    maxX = Math.max(a.x, b.x) + PAD + 4
  const minY = Math.min(a.y, b.y) - PAD - 4,
    maxY = Math.max(a.y, b.y) + PAD + 4
  const near = obstacles.filter((o) => o.x1 > minX && o.x0 < maxX && o.y1 > minY && o.y0 < maxY)
  let fx0 = Math.min(a.x, b.x) - PAD,
    fx1 = Math.max(a.x, b.x) + PAD,
    fy0 = Math.min(a.y, b.y) - PAD,
    fy1 = Math.max(a.y, b.y) + PAD
  for (const o of near) {
    fx0 = Math.min(fx0, o.x0 - PAD)
    fx1 = Math.max(fx1, o.x1 + PAD)
    fy0 = Math.min(fy0, o.y0 - PAD)
    fy1 = Math.max(fy1, o.y1 + PAD)
  }
  const xsRaw = [a.x, b.x, fx0, fx1]
  const ysRaw = [a.y, b.y, fy0, fy1]
  for (const o of near) xsRaw.push(o.x0, o.x1), ysRaw.push(o.y0, o.y1)
  const addMids = (v: number[]) => {
    const s = uniqSorted(v.slice())
    for (let i = 0; i < s.length - 1; i++) if (s[i + 1] - s[i] > 0.3) v.push((s[i] + s[i + 1]) / 2)
    return uniqSorted(v)
  }
  const xs = addMids(xsRaw)
  const ys = addMids(ysRaw)
  const W = xs.length,
    H = ys.length
  const ix = (x: number) => xs.findIndex((v) => Math.abs(v - x) < 1e-6)
  const iy = (y: number) => ys.findIndex((v) => Math.abs(v - y) < 1e-6)
  const si = ix(a.x),
    sj = iy(a.y),
    ti = ix(b.x),
    tj = iy(b.y)
  const pt = (i: number, j: number) => ({ x: xs[i], y: ys[j] })

  // Rasterise the obstacles once: blocked grid points, and blocked steps between neighbouring points.
  // Each obstacle only visits the index range it can cover; the tests are the same as `inside` and `segmentBlocked`.
  const e = 1e-6
  const blockedPt = new Uint8Array(W * H)
  /** Step from (i, j) to (i + 1, j). */
  const blockedH = new Uint8Array(W * H)
  /** Step from (i, j) to (i, j + 1). */
  const blockedV = new Uint8Array(W * H)
  for (const o of near) {
    // Grid lines strictly inside the obstacle.
    const i0 = upperBound(xs, o.x0 + e),
      j0 = upperBound(ys, o.y0 + e)
    let i1 = i0,
      j1 = j0
    while (i1 < W && xs[i1] < o.x1 - e) i1++
    while (j1 < H && ys[j1] < o.y1 - e) j1++
    for (let j = j0; j < j1; j++) for (let i = i0; i < i1; i++) blockedPt[j * W + i] = 1
    // Horizontal steps on rows inside the obstacle that overlap it along x.
    for (let j = j0; j < j1; j++)
      for (let i = Math.max(0, i0 - 1); i < Math.min(W - 1, i1 + 1); i++)
        if (Math.max(xs[i], o.x0) < Math.min(xs[i + 1], o.x1) - e) blockedH[j * W + i] = 1
    // Vertical steps on columns inside the obstacle that overlap it along y.
    for (let i = i0; i < i1; i++)
      for (let j = Math.max(0, j0 - 1); j < Math.min(H - 1, j1 + 1); j++)
        if (Math.max(ys[j], o.y0) < Math.min(ys[j + 1], o.y1) - e) blockedV[j * W + i] = 1
  }

  const startDir = dirIndex(ha)
  const goalDir = hb ? dirIndex(hb) : -1
  const key = (i: number, j: number, d: number) => (j * W + i) * 4 + d
  const best = new Float64Array(W * H * 4).fill(Infinity)
  const prev = new Int32Array(W * H * 4).fill(-1)
  const heap = new Heap<number>()
  const h = (i: number, j: number) => Math.abs(xs[i] - b.x) + Math.abs(ys[j] - b.y)
  const k0 = key(si, sj, startDir)
  best[k0] = 0
  heap.push(h(si, sj), k0)
  let expansions = 0
  let goalKey = -1
  let goalCost = Infinity
  const hasTracks = tracks.size > 0
  const sharedH = new Float64Array(hasTracks ? W * H : 0).fill(NaN)
  const sharedV = new Float64Array(hasTracks ? W * H : 0).fill(NaN)
  while (heap.size && expansions++ < MAX_EXPANSIONS) {
    const k = heap.pop()
    const g = best[k]
    const d = k % 4
    const cell = (k - d) / 4
    const i = cell % W,
      j = (cell - i) / W
    if (g + h(i, j) >= goalCost) break
    if (i === ti && j === tj) {
      const total = g + (goalDir >= 0 && d !== goalDir ? (d === (goalDir + 2) % 4 ? BEND * 3 : BEND) : 0)
      if (total < goalCost) {
        goalCost = total
        goalKey = k
      }
      continue
    }
    for (let nd = 0; nd < 4; nd++) {
      if (nd === (d + 2) % 4) continue // no U-turns
      const ni = i + (nd === 0 ? 1 : nd === 2 ? -1 : 0)
      const nj = j + (nd === 1 ? 1 : nd === 3 ? -1 : 0)
      if (ni < 0 || nj < 0 || ni >= W || nj >= H) continue
      if (blockedPt[nj * W + ni]) continue
      const horizontal = nd === 0 || nd === 2
      if (horizontal ? blockedH[j * W + Math.min(i, ni)] : blockedV[Math.min(j, nj) * W + i]) continue
      const x0 = xs[i],
        y0 = ys[j],
        x1 = xs[ni],
        y1 = ys[nj]
      const len = Math.abs(x1 - x0) + Math.abs(y1 - y0)
      let shared = 0
      if (hasTracks) {
        // Each step is reached from several directions: look its corridor use up once.
        const cache = horizontal ? sharedH : sharedV
        const at = horizontal ? j * W + Math.min(i, ni) : Math.min(j, nj) * W + i
        shared = cache[at]
        if (Number.isNaN(shared))
          cache[at] = shared = horizontal ? tracks.shared(true, y0, Math.min(x0, x1), Math.max(x0, x1)) : tracks.shared(false, x0, Math.min(y0, y1), Math.max(y0, y1))
      }
      const cost = g + len + (nd !== d ? BEND : 0) + (hasTracks ? shared * SHARED : 0)
      const nk = key(ni, nj, nd)
      if (cost < best[nk] - 1e-9) {
        best[nk] = cost
        prev[nk] = k
        heap.push(cost + h(ni, nj), nk)
      }
    }
  }
  if (goalKey < 0) return null
  const cells: Vec2[] = []
  for (let k = goalKey; k >= 0; k = prev[k]) {
    const cell = (k - (k % 4)) / 4
    cells.push(pt(cell % W, Math.floor(cell / W)))
  }
  cells.reverse()
  // Corners only: drop endpoints and straight-through points.
  const inner = simplify(cells)
  return inner.slice(1, -1)
}

export const nodeObstacle = (n: DiagramNode): Obstacle => {
  const b = nodeBox(n)
  return { x0: b.x - CLEAR, y0: b.y - CLEAR, x1: b.x + b.w + CLEAR, y1: b.y + b.d + CLEAR }
}

function tracksOf(pts: Vec2[]): Track[] {
  const out: Track[] = []
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i],
      b = pts[i + 1]
    const horizontal = eq(a.y, b.y)
    out.push(horizontal ? { horizontal, at: a.y, lo: Math.min(a.x, b.x), hi: Math.max(a.x, b.x) } : { horizontal, at: a.x, lo: Math.min(a.y, b.y), hi: Math.max(a.y, b.y) })
  }
  return out
}

/** Faces hidden behind a block in the isometric view. */
export const BACK_PORTS: ReadonlySet<Port> = new Set<Port>(['n', 'w'])

export interface RouteOptions {
  /** Zones that wires may end on. Zones never block wires. */
  zones?: Pick<ZoneData, 'id' | 'x' | 'y' | 'w' | 'd'>[]
}

export type RoutableEdge = Pick<EdgeData, 'id' | 'from' | 'to' | 'waypoints'> & { arrows?: EdgeData['arrows'] }

/** Route every edge orthogonally along the world grid axes, around blocks in the way. */
export function routeEdges(nodes: DiagramNode[], edges: RoutableEdge[], opts: RouteOptions = {}): Map<string, RoutedEdge> {
  return routeAll(nodes, edges, opts).routes
}

export interface RouteResult {
  routes: Map<string, RoutedEdge>
  /** Each route before parallel wires were spread into lanes. `routeAll` can keep these as they are. */
  raw: Map<string, Vec2[]>
}

/**
 * `routeEdges`, with the option to keep earlier routes: an edge listed in `keep` whose ends still sit where
 * its kept route starts and ends keeps that route. The other edges are routed around everything else,
 * avoiding the corridors the kept routes use. Without `keep` the result is exactly `routeEdges`.
 */
export function routeAll(nodes: DiagramNode[], edges: RoutableEdge[], opts: RouteOptions = {}, keep?: ReadonlyMap<string, Vec2[]>): RouteResult {
  // Anything a wire can end on, as a box. Zones lie flat (h = 0).
  const boxes = new Map<string, Box>()
  for (const z of opts.zones ?? []) boxes.set(z.id, zoneBox(z))
  for (const n of nodes) boxes.set(n.id, nodeBox(n))
  type End = { edge: RoutableEdge; which: 'from' | 'to'; id: string; box: Box; port: Port; other: Vec2 }
  const ends: End[] = []
  for (const e of edges) {
    const ia = endId(e.from),
      ib = endId(e.to)
    const a = boxes.get(ia)
    const b = boxes.get(ib)
    if (!a || !b) continue
    const ca = center(a),
      cb = center(b)
    const towardA = e.waypoints[0] ?? cb
    const towardB = e.waypoints[e.waypoints.length - 1] ?? ca
    ends.push({ edge: e, which: 'from', id: ia, box: a, port: e.from.port ?? autoPort(ca, towardA, a.w, a.d), other: towardA })
    ends.push({ edge: e, which: 'to', id: ib, box: b, port: e.to.port ?? autoPort(cb, towardB, b.w, b.d), other: towardB })
  }

  const obstacles = nodes.map(nodeObstacle)

  // Spread multiple wires on the same side so they don't overlap.
  const groups = new Map<string, End[]>()
  for (const end of ends) {
    const key = `${end.id}:${end.port}`
    const list = groups.get(key) ?? []
    list.push(end)
    groups.set(key, list)
  }
  const tOf = new Map<End, number>()
  for (const list of groups.values()) {
    const along = (e: End) => (e.port === 'n' || e.port === 's' ? e.other.x : e.other.y)
    list.sort((p, q) => along(p) - along(q))
    list.forEach((e, i) => tOf.set(e, (i + 1) / (list.length + 1)))
  }

  const tracks = new TrackIndex()
  const raw = new Map<string, Vec2[]>()
  const pairs: { fa: End; tb: End; start: Vec2; end: Vec2 }[] = []
  for (let i = 0; i < ends.length; i += 2) {
    const fa = ends[i],
      tb = ends[i + 1]
    const start = portPoint(fa.box, fa.port, tOf.get(fa))
    const end = portPoint(tb.box, tb.port, tOf.get(tb))
    const kept = keep?.get(fa.edge.id)
    // A kept route still fits when its ends haven't moved; its corridors are known before anything is routed.
    if (kept && kept.length >= 2 && same(kept[0], start) && same(kept[kept.length - 1], end)) {
      raw.set(fa.edge.id, kept)
      for (const t of tracksOf(kept.slice(1, -1))) tracks.add(t)
    }
    pairs.push({ fa, tb, start, end })
  }

  const result = new Map<string, RoutedEdge>()
  for (const { fa, tb, start, end } of pairs) {
    const e = fa.edge
    let points = raw.get(e.id)
    if (!points) {
      const nA = PORT_NORMALS[fa.port]
      const nB = PORT_NORMALS[tb.port]
      const s1 = { x: start.x + nA.x * STUB, y: start.y + nA.y * STUB }
      const e1 = { x: end.x + nB.x * STUB, y: end.y + nB.y * STUB }

      const pts: Vec2[] = [start, s1]
      let cur = s1
      let heading = nA
      const leg = (to: Vec2, arrive?: Vec2) => searchLeg(cur, heading, to, arrive, obstacles, tracks) ?? connect(cur, heading, to, arrive)
      for (const wp of e.waypoints) {
        const corners = leg(wp)
        pts.push(...corners, wp)
        const prev = corners[corners.length - 1] ?? cur
        if (!eq(prev.x, wp.x) || !eq(prev.y, wp.y)) heading = { x: Math.sign(wp.x - prev.x), y: Math.sign(wp.y - prev.y) }
        cur = wp
      }
      pts.push(...leg(e1, { x: -nB.x, y: -nB.y }), e1, end)
      points = simplify(pts)
      raw.set(e.id, points)
      for (const t of tracksOf(points.slice(1, -1))) tracks.add(t)
    }
    result.set(e.id, { id: e.id, points, fromPort: fa.port, toPort: tb.port })
  }
  // Inner points are fresh objects from the search, but stubs/waypoints may be shared: copy before nudging.
  // The raw routes keep their own points, so they stay as routed.
  for (const r of result.values()) r.points = r.points.map((q) => ({ ...q }))
  separateLanes(result.values(), nodes.map((n) => {
    const b = nodeBox(n)
    return { x0: b.x - 0.1, y0: b.y - 0.1, x1: b.x + b.w + 0.1, y1: b.y + b.d + 0.1 }
  }))
  for (const r of result.values()) r.points = simplify(r.points)
  return { routes: result, raw }
}

const same = (a: Vec2, b: Vec2) => eq(a.x, b.x) && eq(a.y, b.y)
