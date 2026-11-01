import { endId, type DiagramNode } from '../model/schema'
import type { Vec2 } from './projection'
import { nodeObstacle, routeAll, type Obstacle, type RoutableEdge, type RoutedEdge, type RouteOptions } from './routing'

/**
 * Routing for the canvas. A full route gives exactly `routeEdges`. An incremental route (used while
 * dragging) keeps every wire the change can't affect and only routes the rest again:
 * wires whose own data changed, wires whose ends moved or were spread differently along a side, and
 * wires that pass close to a block that moved, appeared or disappeared (its old or new place).
 */
export function createRouteCache() {
  let obstacles = new Map<string, Obstacle>()
  let inputs = new Map<string, string>()
  let raw = new Map<string, Vec2[]>()

  return {
    route(nodes: DiagramNode[], edges: RoutableEdge[], opts: RouteOptions, incremental: boolean): Map<string, RoutedEdge> {
      const nextObstacles = new Map(nodes.map((n) => [n.id, nodeObstacle(n)]))
      const nextInputs = new Map(edges.map((e) => [e.id, routeInput(e)]))
      let keep: Map<string, Vec2[]> | undefined
      if (incremental && raw.size) {
        // Blocks that moved, old place and new place.
        const changed: Obstacle[] = []
        for (const [id, o] of nextObstacles) {
          const before = obstacles.get(id)
          if (!before || !sameBox(before, o)) changed.push(o, ...(before ? [before] : []))
        }
        for (const [id, o] of obstacles) if (!nextObstacles.has(id)) changed.push(o)
        keep = new Map()
        for (const [id, points] of raw) {
          if (inputs.get(id) !== nextInputs.get(id)) continue
          if (changed.some((o) => passesNear(points, o))) continue
          keep.set(id, points)
        }
      }
      const result = routeAll(nodes, edges, opts, keep)
      obstacles = nextObstacles
      inputs = nextInputs
      raw = result.raw
      return result.routes
    },
    reset() {
      obstacles = new Map()
      inputs = new Map()
      raw = new Map()
    },
  }
}

export type RouteCache = ReturnType<typeof createRouteCache>

/** What a wire's route depends on, besides the positions of blocks. */
const routeInput = (e: RoutableEdge) => JSON.stringify([endId(e.from), e.from.port, endId(e.to), e.to.port, e.waypoints])

const sameBox = (a: Obstacle, b: Obstacle) => a.x0 === b.x0 && a.y0 === b.y0 && a.x1 === b.x1 && a.y1 === b.y1

/** How close a wire may pass a moved block and still keep its route: beyond this it didn't go around it. */
const NEAR = 0.5

/** True when a segment of the route comes within NEAR of the block (its old or new place). */
function passesNear(points: Vec2[], o: Obstacle): boolean {
  const x0 = o.x0 - NEAR,
    y0 = o.y0 - NEAR,
    x1 = o.x1 + NEAR,
    y1 = o.y1 + NEAR
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i]
    if (Math.max(a.x, b.x) >= x0 && Math.min(a.x, b.x) <= x1 && Math.max(a.y, b.y) >= y0 && Math.min(a.y, b.y) <= y1) return true
  }
  return false
}
