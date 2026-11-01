import { resolveDoc, resolveLabel } from '../model/defaults'
import { endId, type DiagramNode, type Edge, type EdgeData, type NodeData, type PageDoc, type Port, type Settings, type TextData, type TextItem, type Zone, type ZoneData } from '../model/schema'
import { withoutHidden } from '../model/visibility'
import { findCrossings, pointAlong, polylineLength, polylinePath, type Crossing } from './crossings'
import { labelCorners, layoutLabel, type LabelLayout } from './labels'
import { project, TILE, type Projection, type Vec2 } from './projection'
import { createRouteCache, type RouteCache } from './routeCache'
import { BACK_PORTS, routeEdges } from './routing'
import {
  blockFaces,
  boundsOf,
  boxCorners,
  center,
  convexHull,
  depthKey,
  nodeBox,
  noteBox,
  rectAt,
  silhouette,
  unionRect,
  zoneBox,
  type BlockFaces,
  type Box,
  type Rect,
} from './shapes'

export interface SceneNode {
  node: DiagramNode
  box: Box
  faces: BlockFaces
  outline: Vec2[]
  label: LabelLayout | null
}
export interface SceneZone {
  zone: Zone
  poly: Vec2[]
  /** Thin slab under the zone (iso only). */
  slab: { left: Vec2[]; right: Vec2[] } | null
  label: LabelLayout | null
  depth: number
}
export interface SceneEdge {
  edge: Edge
  world: Vec2[]
  screen: Vec2[]
  d: string
  /** Same path without hops, for the flow overlay. */
  plainD: string
  length: number
  crossings: Crossing[]
  arrowStart: Vec2[] | null
  arrowEnd: Vec2[] | null
  /** Wire ends hidden behind a block's back face (iso), redrawn faintly on top. */
  xray: { d: string; arrows: Vec2[][] } | null
  label: LabelLayout | null
}
export interface SceneText {
  text: TextItem
  poly: Vec2[] | null
  anchor: Vec2
  label: LabelLayout | null
}

export interface Scene {
  projection: Projection
  zones: SceneZone[]
  edges: SceneEdge[]
  nodes: SceneNode[]
  texts: SceneText[]
  bounds: Rect | null
}

const ARROW_LEN = 0.32
const ARROW_HALF = 0.17
const SLAB = 0.14

function screenPathD(pts: Vec2[]): string {
  return pts.map((p, i) => `${i ? 'L' : 'M'}${Math.round(p.x * 100) / 100} ${Math.round(p.y * 100) / 100}`).join(' ')
}

/** Arrowhead triangle lying on the ground, tip at `tip`, pointing along `dir` (world units). */
function arrowHead(tip: Vec2, from: Vec2, p: Projection, size = 1): { poly: Vec2[]; base: Vec2 } {
  const len = Math.hypot(tip.x - from.x, tip.y - from.y) || 1
  const ux = (tip.x - from.x) / len,
    uy = (tip.y - from.y) / len
  const L = Math.min(ARROW_LEN * size, len * 0.6)
  const base = { x: tip.x - ux * L, y: tip.y - uy * L }
  const nx = -uy * ARROW_HALF * size,
    ny = ux * ARROW_HALF * size
  return {
    poly: [project(tip.x, tip.y, 0, p), project(base.x + nx, base.y + ny, 0, p), project(base.x - nx, base.y - ny, 0, p)],
    base,
  }
}

/** The scene of a page, built from scratch. Exports, previews and the headless renderer use this. */
export function buildScene(source: PageDoc, p: Projection): Scene {
  return assemble(source, p, null).scene
}

/** Scene items from the last build, by the source item they were made from. */
interface SceneMemo {
  settings: Settings
  projection: Projection
  zones: Map<ZoneData, SceneZone>
  nodes: Map<NodeData, SceneNode>
  texts: Map<TextData, SceneText>
  edges: Map<string, { source: EdgeData; scene: SceneEdge }>
}

/**
 * Builds scenes for the canvas, one after another. Items that didn't change keep their scene objects, so
 * memoised shapes don't redraw. With `incremental` (while dragging) only the wires a change can affect are
 * routed again; a full build gives the same scene as `buildScene`.
 */
export function createSceneBuilder() {
  const router = createRouteCache()
  let memo: SceneMemo | null = null
  let key = ''
  return {
    build(source: PageDoc, p: Projection, opts: { incremental?: boolean } = {}): Scene {
      const k = `${source.id}\n${source.pageId}`
      if (k !== key) {
        router.reset()
        memo = null
        key = k
      }
      const out = assemble(source, p, { router, incremental: !!opts.incremental, memo })
      memo = out.memo
      return out.scene
    },
  }
}

export type SceneBuilder = ReturnType<typeof createSceneBuilder>

interface BuildContext {
  router: RouteCache
  incremental: boolean
  memo: SceneMemo | null
}

function assemble(source: PageDoc, p: Projection, ctx: BuildContext | null): { scene: Scene; memo: SceneMemo } {
  const visible = withoutHidden(source)
  const doc = resolveDoc(visible)
  // Earlier scene items are only valid for the same settings and projection.
  const prev = ctx?.memo && ctx.memo.settings === source.settings && ctx.memo.projection === p ? ctx.memo : null
  const memo: SceneMemo = { settings: source.settings, projection: p, zones: new Map(), nodes: new Map(), texts: new Map(), edges: new Map() }
  // `resolveDoc` keeps the order, so `visible.<kind>[i]` is the source of `doc.<kind>[i]`.
  const reuse = <S, T>(from: Map<S, T> | undefined, to: Map<S, T>, src: S, make: () => T): T => {
    const item = from?.get(src) ?? make()
    to.set(src, item)
    return item
  }
  // Zones: bigger first so nested zones draw on top.
  const zones: SceneZone[] = doc.zones
    .map((zone, i) => reuse(prev?.zones, memo.zones, visible.zones[i], (): SceneZone => {
      const b = zoneBox(zone)
      const poly = rectAt(b, 0, p)
      const slab =
        p === 'iso'
          ? {
              left: [
                project(b.x, b.y + b.d, 0, p),
                project(b.x + b.w, b.y + b.d, 0, p),
                project(b.x + b.w, b.y + b.d, -SLAB, p),
                project(b.x, b.y + b.d, -SLAB, p),
              ],
              right: [
                project(b.x + b.w, b.y, 0, p),
                project(b.x + b.w, b.y + b.d, 0, p),
                project(b.x + b.w, b.y + b.d, -SLAB, p),
                project(b.x + b.w, b.y, -SLAB, p),
              ],
            }
          : null
      const style = resolveLabel(doc, 'zone', zone.label)
      const label = layoutLabel(style, zone.name, zone.description, poly, p)
      return { zone, poly, slab, label, depth: zone.w * zone.d }
    }))
    .sort((a, b) => b.depth - a.depth)

  // Nodes in painter's order.
  const nodes: SceneNode[] = doc.nodes
    .map((node, i) => reuse(prev?.nodes, memo.nodes, visible.nodes[i], (): SceneNode => {
      const box = nodeBox(node)
      const faces = blockFaces(box, p)
      const outline = node.shape === 'icon' ? iconOutline(node, p) : silhouette(box, p)
      const style = resolveLabel(doc, 'node', node.label)
      const c = center(box)
      const label = layoutLabel(style, node.name, node.description, outline, p, project(c.x, c.y, box.h, p))
      return { node, box, faces, outline, label }
    }))
    .sort((a, b) => depthKey(a.box) - depthKey(b.box))

  // Edges.
  const routes = ctx ? ctx.router.route(doc.nodes, doc.edges, { zones: doc.zones }, ctx.incremental) : routeEdges(doc.nodes, doc.edges, { zones: doc.zones })
  const nodeById = new Map(doc.nodes.map((n) => [n.id, n]))
  const sourceOf = new Map(doc.edges.map((e, i) => [e, visible.edges[i]]))
  const ordered = doc.edges.filter((e) => routes.has(e.id))
  const prepared = ordered.map((edge) => {
    const world = routes.get(edge.id)!.points.slice()
    let arrowStart: Vec2[] | null = null
    let arrowEnd: Vec2[] | null = null
    if ((edge.arrows === 'end' || edge.arrows === 'both') && world.length >= 2) {
      const a = arrowHead(world[world.length - 1], world[world.length - 2], p, edge.arrowSize)
      arrowEnd = a.poly
      world[world.length - 1] = a.base
    }
    if ((edge.arrows === 'start' || edge.arrows === 'both') && world.length >= 2) {
      const a = arrowHead(world[0], world[1], p, edge.arrowSize)
      arrowStart = a.poly
      world[0] = a.base
    }
    const screen = world.map((q) => project(q.x, q.y, 0, p))

    // X-ray: ends entering a back face are covered by their block in iso.
    let xray: SceneEdge['xray'] = null
    if (p === 'iso') {
      const route = routes.get(edge.id)!
      const parts: string[] = []
      const arrows: Vec2[][] = []
      const hidden = (nodeId: string, port: Port) => {
        const n = nodeById.get(nodeId)
        return !!n && BACK_PORTS.has(port) && nodeBox(n).h >= 0.3
      }
      const tail = (pts: Vec2[]) => {
        // the last stretch (≤ 1.2 units) leading into the block
        const end = pts[pts.length - 1],
          prev = pts[pts.length - 2]
        const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1
        const k = Math.min(1, 1.2 / len)
        const from = { x: end.x + (prev.x - end.x) * k, y: end.y + (prev.y - end.y) * k }
        return [from, end].map((q) => project(q.x, q.y, 0, p))
      }
      if (world.length >= 2 && hidden(endId(edge.to), route.toPort)) {
        parts.push(screenPathD(tail(world)))
        if (arrowEnd) arrows.push(arrowEnd)
      }
      if (world.length >= 2 && hidden(endId(edge.from), route.fromPort)) {
        parts.push(screenPathD(tail(world.slice().reverse())))
        if (arrowStart) arrows.push(arrowStart)
      }
      if (parts.length) xray = { d: parts.join(' '), arrows }
    }
    return { edge, world, screen, arrowStart, arrowEnd, xray }
  })
  const crossings = findCrossings(prepared.map((e) => e.screen))
  const edges: SceneEdge[] = prepared.map((e, i) => {
    const src = sourceOf.get(e.edge)!
    const before = prev?.edges.get(e.edge.id)
    if (before && before.source === src && samePoints(before.scene.world, e.world) && before.scene.xray?.d === e.xray?.d && sameCrossings(before.scene.crossings, crossings[i])) {
      memo.edges.set(src.id, before)
      return before.scene
    }
    const scene = buildEdge(e, crossings[i])
    memo.edges.set(src.id, { source: src, scene })
    return scene
  })

  function buildEdge(e: (typeof prepared)[number], crossings: Crossing[]): SceneEdge {
    const style = resolveLabel(doc, 'edge', e.edge.label)
    const at = pointAlong(e.screen, e.edge.labelAt)
    let label: LabelLayout | null = null
    if (e.edge.name || (style.showDescription && e.edge.description)) {
      let s = style
      if (style.orientation === 'screen') {
        // On a vertical run, "above/below" would sit on the wire itself: put it beside instead.
        const a = e.screen[at.seg],
          b = e.screen[at.seg + 1] ?? a
        if (Math.abs(b.y - a.y) > Math.abs(b.x - a.x) * 1.5) {
          if (style.side === 'top') s = { ...style, side: 'right' }
          else if (style.side === 'bottom') s = { ...style, side: 'left' }
        }
      } else {
        const a = e.world[at.seg],
          b = e.world[at.seg + 1] ?? a
        const alongX = Math.abs(b.x - a.x) >= Math.abs(b.y - a.y)
        s = { ...style, orientation: alongX ? 'ground-x' : 'ground-y' }
      }
      label = layoutLabel(s, e.edge.name, e.edge.description, [at.point], p)
    }
    return {
      ...e,
      d: polylinePath(e.screen, crossings, doc.settings.crossing, Math.max(5, e.edge.width * 2.5)),
      plainD: screenPathD(e.screen),
      length: polylineLength(e.screen),
      crossings,
      label,
    }
  }

  const texts: SceneText[] = doc.texts.map((text, i) => reuse(prev?.texts, memo.texts, visible.texts[i], (): SceneText => {
    const style = resolveLabel(doc, 'text', text.label)
    if (text.kind === 'note') {
      const b = noteBox(text)
      const poly = rectAt(b, b.h, p)
      const c = center(b)
      const label = layoutLabel(style, text.name, text.description, poly, p, project(c.x, c.y, b.h, p), Math.max(40, (style.orientation === 'ground-y' ? b.d : b.w) * TILE - 24))
      return { text, poly, anchor: project(c.x, c.y, b.h, p), label }
    }
    const anchor = project(text.x, text.y, 0, p)
    return { text, poly: null, anchor, label: layoutLabel(style, text.name, text.description, [anchor], p) }
  }))

  let bounds: Rect | null = null
  for (const z of zones) {
    bounds = unionRect(bounds, boundsOf(z.slab ? [...z.poly, ...z.slab.left, ...z.slab.right] : z.poly))
    if (z.label) bounds = unionRect(bounds, boundsOf(labelCorners(z.label)))
  }
  for (const n of nodes) {
    bounds = unionRect(bounds, boundsOf([...boxCorners(n.box, p), ...n.outline]))
    if (n.label) bounds = unionRect(bounds, boundsOf(labelCorners(n.label)))
  }
  for (const e of edges) {
    if (e.screen.length) bounds = unionRect(bounds, boundsOf(e.screen))
    if (e.label) bounds = unionRect(bounds, boundsOf(labelCorners(e.label)))
  }
  for (const t of texts) {
    if (t.poly) bounds = unionRect(bounds, boundsOf(t.poly))
    if (t.label) bounds = unionRect(bounds, boundsOf(labelCorners(t.label)))
    else bounds = unionRect(bounds, { x: t.anchor.x, y: t.anchor.y, w: 1, h: 1 })
  }

  return { scene: { projection: p, zones, edges, nodes, texts, bounds }, memo }
}

const samePoints = (a: Vec2[], b: Vec2[]) => a.length === b.length && a.every((q, i) => q.x === b[i].x && q.y === b[i].y)
const sameCrossings = (a: Crossing[], b: Crossing[]) =>
  a.length === b.length && a.every((c, i) => c.seg === b[i].seg && c.dist === b[i].dist && c.point.x === b[i].point.x && c.point.y === b[i].point.y)

/** Size of an icon in px for a node. */
export function iconSize(node: DiagramNode): number {
  const base = node.shape === 'icon' ? 0.95 : node.iconPlacement === 'billboard' ? 0.7 : 0.55
  const limit = node.iconPlacement === 'wall-x' ? Math.min(node.w, node.h * 1.2) : node.iconPlacement === 'wall-y' ? Math.min(node.d, node.h * 1.2) : Math.min(node.w, node.d)
  return Math.max(8, limit * TILE * base * node.iconScale)
}

/** Screen outline of an "icon only" node: its footprint plus the standing icon. */
function iconOutline(node: DiagramNode, p: Projection): Vec2[] {
  const b = nodeBox(node)
  const foot = rectAt(b, 0, p)
  if (node.iconPlacement !== 'billboard') return foot
  const c = center(b)
  const g = project(c.x, c.y, 0, p)
  const s = iconSize(node)
  return convexHull([...foot, { x: g.x - s / 2, y: g.y - s - 4 }, { x: g.x + s / 2, y: g.y - s - 4 }])
}
