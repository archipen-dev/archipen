import { useRef, useState, type RefObject } from 'react'
import { insertBend, removeBend } from '../../commands/entity'
import { snap, unproject, type Projection } from '../../geometry/projection'
import type { Scene } from '../../geometry/scene'
import { screenToScene } from '../../geometry/viewport'
import { isTypingIn } from '../../lib/dom'
import { lockedIds } from '../../model/visibility'
import { getPage } from '../../store/selectors'
import { useUi } from '../../store/uiStore'
import { hitAt } from './hitTest'
import { startGesture } from './gestures/start'
import type { Gesture, GestureContext, PointerPoint } from './gestures/types'
import type { Preview } from './Overlay'

type PointerLike = { clientX: number; clientY: number; shiftKey: boolean; altKey: boolean; ctrlKey: boolean; metaKey: boolean }

/** Pointer handling for the canvas: hover, and one gesture strategy per drag. */
export function useGestures(containerRef: RefObject<HTMLDivElement | null>, scene: Scene, projection: Projection) {
  const gesture = useRef<Gesture | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [panning, setPanning] = useState(false)
  const ctx: GestureContext = { scene, setPreview }

  const point = (e: PointerLike): PointerPoint => {
    const r = containerRef.current!.getBoundingClientRect()
    const local = { x: e.clientX - r.left, y: e.clientY - r.top }
    const sp = screenToScene(useUi.getState().viewport, local)
    return { clientX: e.clientX, clientY: e.clientY, local, scene: sp, world: unproject(sp.x, sp.y, projection), shift: e.shiftKey, alt: e.altKey, mod: e.ctrlKey || e.metaKey }
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button === 2) return
    if (isTypingIn(document.activeElement)) (document.activeElement as HTMLElement).blur()
    e.currentTarget.setPointerCapture(e.pointerId)
    const g = startGesture(point(e), { button: e.button })
    gesture.current = g
    setPanning(!!g?.panning)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    const g = gesture.current
    if (g) return g.move(point(e), ctx)
    const id = hitAt(e.clientX, e.clientY)?.id ?? null
    const ui = useUi.getState()
    if (id !== ui.hoverId) ui.setHover(id)
  }

  const onPointerUp = (e: React.PointerEvent) => {
    const g = gesture.current
    gesture.current = null
    setPanning(false)
    setPreview(null)
    g?.end(point(e), ctx)
  }

  /** Double-click: rename an item, add a bend to a wire, or remove a bend. */
  const onDoubleClick = (e: React.MouseEvent) => {
    const ui = useUi.getState()
    if (ui.mode !== 'edit' || ui.tool !== 'select') return
    const hit = hitAt(e.clientX, e.clientY)
    if (!hit) return
    if (hit.type === 'handle') {
      if (hit.handle === 'waypoint') removeBend(hit.id, Math.max(0, hit.index))
      return
    }
    if (hit.kind === 'edge' && !hit.label) {
      if (lockedIds(getPage()!).has(hit.id)) return void ui.select([hit.id])
      const w = point(e).world
      insertBend(hit.id, { x: snap(w.x, 0.5), y: snap(w.y, 0.5) })
      ui.select([hit.id])
      return
    }
    ui.setEditing(hit.id)
  }

  const onPointerLeave = () => !gesture.current && useUi.getState().setHover(null)

  return { preview, panning, handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel: onPointerUp, onPointerLeave, onDoubleClick } }
}
