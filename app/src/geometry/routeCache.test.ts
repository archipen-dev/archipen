import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { parseDoc, resolveDoc } from '../model/defaults'
import { pageView } from '../model/pages'
import type { Doc } from '../model/schema'
import { createRouteCache } from './routeCache'
import { routeEdges, segmentBlocked, nodeObstacle } from './routing'
import { buildScene, createSceneBuilder } from './scene'
import { gridDiagram } from './testDiagrams'

const view = (doc: Doc) => resolveDoc(pageView(doc))
const route = (cache: ReturnType<typeof createRouteCache>, doc: Doc, incremental: boolean) => {
  const v = view(doc)
  return cache.route(v.nodes, v.edges, { zones: v.zones }, incremental)
}
const moveNode = (doc: Doc, id: string, dx: number, dy: number) =>
  produce(doc, (d) => {
    const n = d.pages[0].nodes.find((n) => n.id === id)!
    n.x += dx
    n.y += dy
  })

describe('route cache', () => {
  const start = parseDoc(gridDiagram(64, 'neighbours'))

  it('a full route is exactly routeEdges', () => {
    const v = view(start)
    expect(route(createRouteCache(), start, false)).toEqual(routeEdges(v.nodes, v.edges, { zones: v.zones }))
  })

  it('while dragging, keeps the wires far from the moved block and reroutes the ones attached to it', () => {
    const cache = createRouteCache()
    const before = route(cache, start, false)
    const after = route(cache, moveNode(start, 'n0', 0.5, 0.5), true)
    // e40 joins n40 and n41, on the far side of the grid from n0.
    expect(after.get('e40')).toEqual(before.get('e40'))
    // e0 starts at n0, which moved.
    expect(after.get('e0')!.points[0]).not.toEqual(before.get('e0')!.points[0])
  })

  it('wires rerouted while dragging still avoid the blocks', () => {
    const cache = createRouteCache()
    route(cache, start, false)
    let doc = start
    // n9 moves from (4, 4) to (5, 5), staying clear of its neighbours.
    for (let k = 0; k < 4; k++) {
      doc = moveNode(doc, 'n9', 0.25, 0.25)
      route(cache, doc, true)
    }
    const v = view(doc)
    const routes = route(cache, doc, true)
    for (const e of v.edges) {
      const pts = routes.get(e.id)!.points.slice(1, -1)
      const others = v.nodes.filter((n) => n.id !== e.from.nodeId && n.id !== e.to.nodeId).map(nodeObstacle)
      expect(pts.some((p, i) => i > 0 && segmentBlocked(pts[i - 1], p, others)), e.id).toBe(false)
    }
  })

  it('after a drag, a full route equals routing from scratch', () => {
    const cache = createRouteCache()
    route(cache, start, false)
    let doc = start
    for (let k = 0; k < 5; k++) route(cache, (doc = moveNode(doc, 'n20', 0.5, 0)), true)
    const v = view(doc)
    expect(route(cache, doc, false)).toEqual(routeEdges(v.nodes, v.edges, { zones: v.zones }))
  })
})

describe('scene builder', () => {
  const start = parseDoc(gridDiagram(36, 'neighbours'))

  it('keeps the scene objects of items that did not change', () => {
    const builder = createSceneBuilder()
    const a = builder.build(pageView(start), 'iso')
    const moved = moveNode(start, 'n0', 1, 0)
    const b = builder.build(pageView(moved), 'iso', { incremental: true })
    const byId = (s: typeof a) => new Map(s.nodes.map((n) => [n.node.id, n]))
    expect(byId(b).get('n35')).toBe(byId(a).get('n35'))
    expect(byId(b).get('n0')).not.toBe(byId(a).get('n0'))
    const edge = (s: typeof a, id: string) => s.edges.find((e) => e.edge.id === id)
    expect(edge(b, 'e30')).toBe(edge(a, 'e30'))
  })

  it('builds the same scene as buildScene once the drag ends', () => {
    const builder = createSceneBuilder()
    builder.build(pageView(start), 'iso')
    let doc = start
    for (let k = 0; k < 4; k++) builder.build(pageView((doc = moveNode(doc, 'n7', 0.5, 0.5))), 'iso', { incremental: true })
    expect(builder.build(pageView(doc), 'iso')).toEqual(buildScene(pageView(doc), 'iso'))
  })

  it('starts over when the settings change', () => {
    const builder = createSceneBuilder()
    const a = builder.build(pageView(start), 'iso')
    const restyled = produce(start, (d) => {
      d.settings.labelDefaults.node.fontSize = 20
    })
    const b = builder.build(pageView(restyled), 'iso')
    expect(b.nodes[0]).not.toBe(a.nodes[0])
    expect(b).toEqual(buildScene(pageView(restyled), 'iso'))
  })
})
