import { describe, expect, it } from 'vitest'
import { defaultStyles, emptyDoc, makeEdge, makeNode as makeNodeData, parseDoc, resolveDoc, resolveNode, sampleDoc } from '../model/defaults'
import { pageView } from '../model/pages'

const makeNode = (p: Parameters<typeof makeNodeData>[0]) => resolveNode(defaultStyles(), makeNodeData(p))
import { findCrossings, pointAlong, polylinePath, segmentIntersection } from './crossings'
import { layoutLabel } from './labels'
import { orientationMatrix } from './planes'
import { project, unproject } from './projection'
import { routeEdges, simplify } from './routing'
import { buildScene } from './scene'
import { convexHull } from './shapes'

describe('projection', () => {
  it.each(['iso', '2d'] as const)('round-trips ground points (%s)', (p) => {
    for (const [x, y] of [
      [0, 0],
      [3.5, -2],
      [-7, 11],
    ]) {
      const s = project(x, y, 0, p)
      const w = unproject(s.x, s.y, p)
      expect(w.x).toBeCloseTo(x)
      expect(w.y).toBeCloseTo(y)
    }
  })
  it('lifts points with height in iso', () => {
    expect(project(1, 1, 1, 'iso').y).toBeLessThan(project(1, 1, 0, 'iso').y)
  })
  it('orientation matrices never mirror text', () => {
    for (const o of ['screen', 'ground-x', 'ground-y', 'wall-x', 'wall-y'] as const)
      for (const p of ['iso', '2d'] as const) {
        const m = orientationMatrix(o, p)
        expect(m.a * m.d - m.b * m.c).toBeGreaterThan(0)
      }
  })
})

describe('routing', () => {
  it('routes orthogonally between nodes', () => {
    const a = makeNode({ x: 0, y: 0 })
    const b = makeNode({ x: 6, y: 4 })
    const e = makeEdge({ from: { nodeId: a.id }, to: { nodeId: b.id } })
    const r = routeEdges([a, b], [e]).get(e.id)!
    expect(r.fromPort).toBe('e')
    expect(r.toPort).toBe('w')
    for (let i = 0; i < r.points.length - 1; i++) {
      const p = r.points[i],
        q = r.points[i + 1]
      expect(p.x === q.x || p.y === q.y).toBe(true)
    }
    expect(r.points[0]).toEqual({ x: 2, y: 1 })
    expect(r.points[r.points.length - 1]).toEqual({ x: 6, y: 5 })
  })
  it('passes through waypoints', () => {
    const a = makeNode({ x: 0, y: 0 })
    const b = makeNode({ x: 10, y: 0 })
    const e = makeEdge({ from: { nodeId: a.id }, to: { nodeId: b.id }, waypoints: [{ x: 5, y: 6 }] })
    const r = routeEdges([a, b], [e]).get(e.id)!
    const onPath = r.points.slice(1).some((q, i) => {
      const a = r.points[i]
      const within = (v: number, m: number, n: number) => v >= Math.min(m, n) - 1e-9 && v <= Math.max(m, n) + 1e-9
      return within(5, a.x, q.x) && within(6, a.y, q.y) && (a.x === q.x || a.y === q.y)
    })
    expect(onPath).toBe(true)
  })
  it('spreads several wires on one side', () => {
    const a = makeNode({ x: 0, y: 0 })
    const b = makeNode({ x: 6, y: -3 })
    const c = makeNode({ x: 6, y: 3 })
    const e1 = makeEdge({ from: { nodeId: a.id }, to: { nodeId: b.id }, })
    const e2 = makeEdge({ from: { nodeId: a.id }, to: { nodeId: c.id } })
    const r = routeEdges([a, b, c], [e1, e2])
    expect(r.get(e1.id)!.points[0].y).toBeLessThan(r.get(e2.id)!.points[0].y)
  })
  it('simplify drops collinear points', () => {
    expect(
      simplify([
        { x: 0, y: 0 },
        { x: 1, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 0 },
        { x: 2, y: 3 },
      ]),
    ).toEqual([
      { x: 0, y: 0 },
      { x: 2, y: 0 },
      { x: 2, y: 3 },
    ])
  })
})

describe('crossings', () => {
  it('finds proper intersections only', () => {
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: -5 }, { x: 5, y: 5 })?.point).toEqual({ x: 5, y: 0 })
    expect(segmentIntersection({ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 5 })).toBeNull()
  })
  it('later wire hops over earlier one', () => {
    const h = [
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]
    const v = [
      { x: 50, y: -50 },
      { x: 50, y: 50 },
    ]
    const c = findCrossings([h, v])
    expect(c[0]).toHaveLength(0)
    expect(c[1]).toHaveLength(1)
    expect(polylinePath(v, c[1], 'hop')).toContain('A')
    expect(polylinePath(v, c[1], 'gap')).toMatch(/M[^M]+M/)
    expect(polylinePath(v, c[1], 'none')).not.toContain('A')
  })
  it('pointAlong finds the midpoint', () => {
    expect(
      pointAlong(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
          { x: 10, y: 10 },
        ],
        0.5,
      ).point,
    ).toEqual({ x: 10, y: 0 })
  })
})

describe('labels', () => {
  const style = emptyDoc().settings.labelDefaults.node
  const box = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 50 },
    { x: 0, y: 50 },
  ]
  it('places below / above / beside', () => {
    const below = layoutLabel({ ...style, side: 'bottom' }, 'Name', '', box, '2d')!
    expect(below.box.y).toBeGreaterThan(50)
    const above = layoutLabel({ ...style, side: 'top' }, 'Name', '', box, '2d')!
    expect(above.box.y + above.box.h).toBeLessThan(0)
    const right = layoutLabel({ ...style, side: 'right' }, 'Name', '', box, '2d')!
    expect(right.anchor).toBe('start')
    expect(right.lines[0].x).toBeGreaterThan(100)
    const leftIn = layoutLabel({ ...style, side: 'left', inside: true }, 'Name', '', box, '2d')!
    expect(leftIn.lines[0].x).toBeGreaterThan(0)
  })
  it('adds description lines when enabled', () => {
    const l = layoutLabel({ ...style, showDescription: true }, 'Name', 'Some description', box, '2d')!
    expect(l.lines).toHaveLength(2)
    expect(layoutLabel({ ...style, hidden: true }, 'Name', '', box, '2d')).toBeNull()
  })
})

describe('scene + schema', () => {
  it('builds the sample in both projections', () => {
    const doc = sampleDoc()
    for (const p of ['iso', '2d'] as const) {
      const s = buildScene(pageView(doc), p)
      expect(s.nodes).toHaveLength(doc.pages[0].nodes.length)
      expect(s.edges).toHaveLength(doc.pages[0].edges.length)
      expect(s.bounds!.w).toBeGreaterThan(0)
    }
  })
  it('round-trips through JSON and validation', () => {
    const doc = sampleDoc()
    expect(parseDoc(JSON.parse(JSON.stringify(doc)))).toEqual(doc)
    expect(() => parseDoc({ format: 'nope' })).toThrow(/Not a valid Archipen file/)
  })
  it('convex hull of a square', () => {
    const h = convexHull([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0.5, y: 0.5 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
    ])
    expect(h).toHaveLength(4)
  })
})

describe('style defaults', () => {
  it('items inherit defaults until they override', () => {
    const doc = emptyDoc()
    doc.settings.styles.edge.width = 5
    doc.settings.styles.node.color = '#123456'
    const a = makeNodeData({ x: 0, y: 0 })
    const b = makeNodeData({ x: 4, y: 0, color: '#abcdef' })
    doc.pages[0].nodes.push(a, b)
    doc.pages[0].edges.push(makeEdge({ from: { nodeId: a.id }, to: { nodeId: b.id }, flow: { speed: 3 } }))
    const r = resolveDoc(pageView(doc))
    expect(r.nodes[0].color).toBe('#123456')
    expect(r.nodes[1].color).toBe('#abcdef')
    expect(r.edges[0].width).toBe(5)
    expect(r.edges[0].flow).toEqual({ enabled: true, direction: 'forward', speed: 3 })
  })
})
