/*
 * Editor-only drawing on top of the scene: hover and selection outlines, drag handles,
 * port dots, and the preview of the gesture in progress.
 */
import { memo, type ReactNode } from 'react'
import { entityOutline, type Outline } from '../../geometry/hit'
import { project, type Vec2 } from '../../geometry/projection'
import type { Scene } from '../../geometry/scene'
import { nodeBox, PORT_NORMALS, portPoint, toPoints } from '../../geometry/shapes'
import type { Port } from '../../model/schema'
import type { HandleKind } from './hitTest'

export type Preview =
  { type: 'marquee'; x: number; y: number; w: number; h: number } | { type: 'connect'; from: Vec2; to: Vec2; overId: string | null } | { type: 'zone'; poly: Vec2[] }

interface Props {
  scene: Scene
  accent: string
  zoom: number
  selection: string[]
  hoverId: string | null
  /** Edit mode: show handles on a single selected item. */
  editing: boolean
  /** The single selected item is locked: outline it, but draw no resize or bend handles. */
  selectionLocked: boolean
  showPorts: boolean
  preview: Preview | null
}

export const Overlay = memo(function Overlay({ scene, accent, zoom, selection, hoverId, editing, selectionLocked, showPorts, preview }: Props) {
  const single = editing && !selectionLocked && selection.length === 1 ? selection[0] : null
  return (
    <g className="ap-overlay" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      {hoverId && !selection.includes(hoverId) && <ItemOutline scene={scene} id={hoverId} color={accent} zoom={zoom} strong={false} />}
      {selection.map((id) => (
        <ItemOutline key={id} scene={scene} id={id} color={accent} zoom={zoom} strong />
      ))}
      {preview && <GesturePreview preview={preview} scene={scene} color={accent} zoom={zoom} />}
      {single && <SelectionHandles scene={scene} id={single} color={accent} zoom={zoom} />}
      {showPorts && hoverId && <PortHandles scene={scene} id={hoverId} color={accent} zoom={zoom} />}
    </g>
  )
})

type Look = { color: string; zoom: number }

function ItemOutline({ scene, id, color, zoom, strong }: Look & { scene: Scene; id: string; strong: boolean }) {
  const o = entityOutline(scene, id)
  return o ? <OutlineShape o={o} color={color} zoom={zoom} strong={strong} /> : null
}

function OutlineShape({ o, color, zoom, strong }: Look & { o: Outline; strong: boolean }) {
  if (o.kind === 'path')
    return (
      <path d={o.d} fill="none" stroke={color} strokeOpacity={strong ? 0.35 : 0.22} strokeWidth={o.width + (strong ? 8 : 6) / zoom} strokeLinecap="round" strokeLinejoin="round" />
    )
  return <polygon points={toPoints(o.points)} fill="none" stroke={color} strokeWidth={(strong ? 1.75 : 1.25) / zoom} strokeOpacity={strong ? 1 : 0.6} strokeLinejoin="round" />
}

const HANDLE_CURSOR: Record<HandleKind, string> = { height: 'ns-resize', resize: 'nwse-resize', port: 'crosshair', waypoint: 'move', end: 'crosshair' }

/** A draggable dot. The data attributes are what the canvas hit test looks for. */
function Handle({ at, zoom, color, kind, id, index, title, shape = 'square' }: Look & { at: Vec2; kind: HandleKind; id: string; index?: number; title: string; shape?: 'square' | 'circle' | 'diamond' }) {
  const s = 9 / zoom
  const common = {
    'data-handle': kind,
    'data-id': id,
    'data-index': index,
    fill: '#fff',
    stroke: color,
    strokeWidth: 1.5 / zoom,
    style: { pointerEvents: 'all' as const, cursor: HANDLE_CURSOR[kind] },
  }
  const r = s / 1.6
  return (
    <g>
      <title>{title}</title>
      {shape === 'circle' ? (
        <circle cx={at.x} cy={at.y} r={s / 2 + 0.5 / zoom} {...common} />
      ) : shape === 'diamond' ? (
        <polygon points={toPoints([{ x: at.x, y: at.y - r }, { x: at.x + r, y: at.y }, { x: at.x, y: at.y + r }, { x: at.x - r, y: at.y }])} {...common} />
      ) : (
        <rect x={at.x - s / 2} y={at.y - s / 2} width={s} height={s} rx={2 / zoom} {...common} />
      )}
    </g>
  )
}

/** Resize corner, height knob (iso blocks) and wire bends of the selected item. */
function SelectionHandles({ scene, id, color, zoom }: Look & { scene: Scene; id: string }) {
  const p = scene.projection
  const look = { color, zoom }
  const handles: ReactNode[] = []
  const node = scene.nodes.find((n) => n.node.id === id)?.node
  const zone = scene.zones.find((z) => z.zone.id === id)?.zone
  const note = scene.texts.find((t) => t.text.id === id && t.text.kind === 'note')?.text
  const box = node ?? zone ?? note
  if (box) {
    const h = node ? nodeBox(node).h : note ? 0.05 : 0
    handles.push(<Handle key="r" kind="resize" id={id} at={project(box.x + box.w, box.y + box.d, h, p)} {...look} title="Resize" />)
  }
  if (node && p === 'iso' && (node.shape === 'block' || node.shape === 'cylinder')) {
    const top = project(node.x + node.w / 2, node.y + node.d / 2, node.h, p)
    handles.push(<Handle key="h" kind="height" id={id} at={{ x: top.x, y: top.y - 14 / zoom }} {...look} shape="circle" title="Drag to change height" />)
  }
  const sceneEdge = scene.edges.find((e) => e.edge.id === id)
  const edge = sceneEdge?.edge
  if (sceneEdge && sceneEdge.screen.length >= 2) {
    const ends = [sceneEdge.screen[0], sceneEdge.screen[sceneEdge.screen.length - 1]]
    ends.forEach((at, i) => handles.push(<Handle key={`e${i}`} kind="end" id={id} index={i} at={at} {...look} shape="circle" title="Drag to another node to re-attach" />))
  }
  edge?.waypoints.forEach((w, i) =>
    handles.push(<Handle key={`w${i}`} kind="waypoint" id={id} index={i} at={project(w.x, w.y, 0, p)} {...look} shape="diamond" title="Drag to bend · double-click to remove" />),
  )
  return <>{handles}</>
}

const PORTS: Port[] = ['n', 'e', 's', 'w']

/** The four connection dots around a hovered node. */
function PortHandles({ scene, id, color, zoom }: Look & { scene: Scene; id: string }) {
  const node = scene.nodes.find((n) => n.node.id === id)?.node
  if (!node) return null
  const b = nodeBox(node)
  return (
    <>
      {PORTS.map((port) => {
        const w = portPoint(b, port)
        const n = PORT_NORMALS[port]
        const at = project(w.x + n.x * 0.18, w.y + n.y * 0.18, 0, scene.projection)
        return <Handle key={port} kind="port" id={id} at={at} color={color} zoom={zoom} shape="circle" title="Drag to connect" />
      })}
    </>
  )
}

function GesturePreview({ preview, scene, color, zoom }: Look & { preview: Preview; scene: Scene }) {
  const dash = `${6 / zoom} ${4 / zoom}`
  switch (preview.type) {
    case 'connect':
      return (
        <>
          {preview.overId && <ItemOutline scene={scene} id={preview.overId} color={color} zoom={zoom} strong />}
          <line x1={preview.from.x} y1={preview.from.y} x2={preview.to.x} y2={preview.to.y} stroke={color} strokeWidth={2 / zoom} strokeDasharray={dash} strokeLinecap="round" />
          <circle cx={preview.to.x} cy={preview.to.y} r={4 / zoom} fill={color} />
        </>
      )
    case 'marquee':
      return <rect x={preview.x} y={preview.y} width={preview.w} height={preview.h} fill={color} fillOpacity={0.06} stroke={color} strokeWidth={1 / zoom} />
    case 'zone':
      return <polygon points={toPoints(preview.poly)} fill={color} fillOpacity={0.08} stroke={color} strokeWidth={1.5 / zoom} strokeDasharray={dash} />
  }
}
