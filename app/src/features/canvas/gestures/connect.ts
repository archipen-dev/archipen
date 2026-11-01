import { addEdge } from '../../../commands/create'
import { reconnectEdge } from '../../../commands/entity'
import { project } from '../../../geometry/projection'
import { center } from '../../../geometry/shapes'
import { findBox } from '../../../model/entities'
import { endId } from '../../../model/schema'
import { getPage } from '../../../store/selectors'
import { useUi } from '../../../store/uiStore'
import { hitAt, isConnectable } from '../hitTest'
import type { Gesture, GestureContext, PointerPoint } from './types'

/** Show the dashed wire from `from` to the pointer; returns the node or zone under the pointer it could attach to. */
function trackWire(from: string, p: PointerPoint, { scene, setPreview }: GestureContext): string | null {
  const hit = hitAt(p.clientX, p.clientY)
  const overId = isConnectable(hit) && hit.id !== from ? hit.id : null
  const box = findBox(getPage()!, from)
  if (box) {
    const c = center(box)
    setPreview({ type: 'connect', from: project(c.x, c.y, 0, scene.projection), to: p.scene, overId })
  }
  return overId
}

/** Drag a new wire from `from` to whatever node or zone the pointer is released over. */
export function connectGesture(from: string): Gesture {
  let overId: string | null = null
  return {
    move(p, ctx) {
      overId = trackWire(from, p, ctx)
      const ui = useUi.getState()
      if (ui.hoverId !== from) ui.setHover(from)
    },
    end() {
      if (!overId) return
      const id = addEdge(from, overId)
      if (id) useUi.getState().select([id])
    },
  }
}

/** Drag one end of a wire onto another node or zone. The other end stays put; letting go over nothing changes nothing. */
export function reconnectGesture(edgeId: string, end: 'from' | 'to'): Gesture {
  let overId: string | null = null
  return {
    move(p, ctx) {
      const edge = getPage()!.edges.find((e) => e.id === edgeId)
      if (!edge) return
      overId = trackWire(endId(end === 'from' ? edge.to : edge.from), p, ctx)
    },
    end() {
      if (overId) reconnectEdge(edgeId, end, overId)
    },
  }
}
