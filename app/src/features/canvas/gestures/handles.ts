/*
 * Dragging the editor handles of the selected item: resize, height and wire bends.
 * Each runs inside one undo step.
 */
import { history, mutateEntity, mutatePage } from '../../../commands/mutate'
import { snap, TILE } from '../../../geometry/projection'
import { recomputeMembership } from '../../../model/membership'
import { insertWaypoint } from '../../../model/ops'
import { useUi } from '../../../store/uiStore'
import { dragged, snapStep, type Gesture, type PointerPoint } from './types'

/** Wrap a handle drag in one undo step; zone membership is updated at the end. */
function handleGesture(move: Gesture['move']): Gesture {
  history.begin()
  return {
    move,
    end() {
      mutatePage((d) => recomputeMembership(d))
      history.commit()
    },
  }
}

/** Drag the far corner: width and depth. */
export function resizeGesture(start: PointerPoint, id: string, base: { w: number; d: number }): Gesture {
  return handleGesture((p) => {
    const step = snapStep(p)
    const min = step === 1 ? 1 : 0.25
    const w = Math.max(min, snap(base.w + p.world.x - start.world.x, step))
    const d = Math.max(min, snap(base.d + p.world.y - start.world.y, step))
    mutateEntity<{ w: number; d: number }>(id, (it) => {
      it.w = w
      it.d = d
    })
  })
}

/** Drag the knob above a block: its height, in tenths. */
export function heightGesture(start: PointerPoint, id: string, baseH: number): Gesture {
  return handleGesture((p) => {
    const zoom = useUi.getState().viewport.zoom
    const h = Math.max(0.1, Math.round((baseH + (start.local.y - p.local.y) / zoom / TILE) * 10) / 10)
    mutateEntity<{ h: number }>(id, (it) => void (it.h = h))
  })
}

/** Put bend `index` of a wire under the pointer, on half cells (or fine steps with Mod). */
function placeBend(edgeId: string, index: number, p: PointerPoint) {
  const step = snapStep(p) === 1 ? 0.5 : 0.05
  mutatePage((d) => {
    const edge = d.edges.find((x) => x.id === edgeId)
    if (edge?.waypoints[index]) edge.waypoints[index] = { x: snap(p.world.x, step), y: snap(p.world.y, step) }
  })
}

/** Drag a wire bend. */
export function waypointGesture(edgeId: string, index: number): Gesture {
  return handleGesture((p) => placeBend(edgeId, index, p))
}

/** Drag the line of a straight wire: a bend appears where it was pressed and follows the pointer. A plain click adds nothing. */
export function bendGesture(start: PointerPoint, edgeId: string): Gesture {
  let moved = false
  return {
    move(p) {
      if (!moved && !dragged(start.local, p.local)) return
      if (!moved) {
        moved = true
        history.begin()
        mutatePage((d) => insertWaypoint(d, edgeId, start.world))
      }
      placeBend(edgeId, 0, p)
    },
    end() {
      if (!moved) return
      mutatePage((d) => recomputeMembership(d))
      history.commit()
    },
  }
}
