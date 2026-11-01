import { describe, expect, it } from 'vitest'
import { defaultStyles, makeEdge, makeNode, resolveNode } from '../model/defaults'
import type { DiagramNode } from '../model/schema'
import { LANE, separateLanes } from './nudge'
import type { Vec2 } from './projection'
import { nodeObstacle, routeEdges, segmentBlocked, type RoutedEdge } from './routing'

const node = (x: number, y: number, extra: Partial<DiagramNode> = {}) => ({ ...resolveNode(defaultStyles(), makeNode({ x, y })), ...extra })
const edge = (from: DiagramNode, to: DiagramNode, extra = {}) => ({ ...makeEdge({ from: { nodeId: from.id }, to: { nodeId: to.id } }), arrows: 'end' as const, ...extra })

const orthogonal = (pts: Vec2[]) => pts.every((p, i) => i === 0 || p.x === pts[i - 1].x || p.y === pts[i - 1].y)
const hitsBox = (pts: Vec2[], n: DiagramNode) => {
  const o = nodeObstacle(n)
  // strictly inside the block itself (not just its clearance margin)
  const box = { x0: o.x0 + 0.3, y0: o.y0 + 0.3, x1: o.x1 - 0.3, y1: o.y1 - 0.3 }
  return pts.some((p, i) => i > 0 && segmentBlocked(pts[i - 1], p, [box]))
}

describe('obstacle-avoiding routing', () => {
  it('goes around a block that sits between two nodes', () => {
    const a = node(0, 0),
      blocker = node(5, 0),
      b = node(10, 0)
    const e = edge(a, b)
    const r = routeEdges([a, blocker, b], [e]).get(e.id)!
    expect(orthogonal(r.points)).toBe(true)
    expect(hitsBox(r.points, blocker)).toBe(false)
    expect(r.points[0]).toEqual({ x: 2, y: 1 })
    expect(r.points[r.points.length - 1]).toEqual({ x: 10, y: 1 })
  })

  it('keeps a straight wire when nothing is in the way', () => {
    const a = node(0, 0),
      b = node(10, 0)
    const e = edge(a, b)
    expect(routeEdges([a, b], [e]).get(e.id)!.points).toHaveLength(2)
  })

  it('still passes through waypoints', () => {
    const a = node(0, 0),
      blocker = node(5, 0),
      b = node(10, 0)
    const e = edge(a, b, { waypoints: [{ x: 6, y: 6 }] })
    const pts = routeEdges([a, blocker, b], [e]).get(e.id)!.points
    const on = pts.slice(1).some((q, i) => {
      const p = pts[i]
      return (p.x === q.x && p.x === 6 && Math.min(p.y, q.y) <= 6 && Math.max(p.y, q.y) >= 6) || (p.y === q.y && p.y === 6 && Math.min(p.x, q.x) <= 6 && Math.max(p.x, q.x) >= 6)
    })
    expect(on).toBe(true)
  })

  it('falls back to a direct route when the target is boxed in', () => {
    const a = node(0, 0),
      b = node(10, 0)
    const walls = [node(8, -2, { w: 6, d: 1 }), node(8, 3, { w: 6, d: 1 }), node(7, -2, { w: 1, d: 6 }), node(13, -2, { w: 1, d: 6 })]
    const e = edge(a, b)
    const r = routeEdges([a, b, ...walls], [e]).get(e.id)!
    expect(r.points.length).toBeGreaterThanOrEqual(2)
    expect(orthogonal(r.points)).toBe(true)
  })

  it('keeps a back face as the arrow end (iso draws it as x-ray, so both views route the same)', () => {
    const src = node(20, -4),
      back = node(16, 4, { h: 1.6 })
    const e = edge(src, back)
    expect(routeEdges([src, back], [e]).get(e.id)!.toPort).toBe('n')
  })
})

describe('lane separation', () => {
  it('spreads wires sharing a corridor at least one lane apart', () => {
    const r = (id: string, pts: Vec2[]): RoutedEdge => ({ id, points: pts, fromPort: 'e', toPort: 'w' })
    const a = r('a', [
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 1, y: 5 },
      { x: 8, y: 5 },
      { x: 8, y: 0 },
      { x: 9, y: 0 },
    ])
    const b = r('b', [
      { x: 0, y: 10 },
      { x: 2, y: 10 },
      { x: 2, y: 5 },
      { x: 7, y: 5 },
      { x: 7, y: 10 },
      { x: 9, y: 10 },
    ])
    separateLanes([a, b], [])
    const ya = a.points[2].y,
      yb = b.points[2].y
    expect(Math.abs(ya - yb)).toBeGreaterThanOrEqual(LANE - 1e-9)
    // the wire coming from above takes the upper lane, so the two don't cross
    expect(ya).toBeLessThan(yb)
    expect(orthogonal(a.points) && orthogonal(b.points)).toBe(true)
  })
})

describe('wires to zones', () => {
  const zone = { id: 'z', x: 10, y: -2, w: 6, d: 6 }
  it('ends on the zone border and does not treat zones as obstacles', () => {
    const a = node(0, 0)
    const e = { ...makeEdge({ from: { nodeId: a.id }, to: { zoneId: 'z' } }), arrows: 'end' as const }
    const r = routeEdges([a], [e], { zones: [zone] }).get(e.id)!
    expect(orthogonal(r.points)).toBe(true)
    expect(r.toPort).toBe('w')
    const last = r.points[r.points.length - 1]
    expect(last.x).toBe(10)
    expect(last.y).toBeGreaterThan(-2)
    expect(last.y).toBeLessThan(4)
  })
  it('skips a wire whose zone is unknown', () => {
    const a = node(0, 0)
    const e = makeEdge({ from: { nodeId: a.id }, to: { zoneId: 'nope' } })
    expect(routeEdges([a], [e]).has(e.id)).toBe(false)
  })
})
