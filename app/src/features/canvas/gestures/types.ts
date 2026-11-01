import type { Vec2 } from '../../../geometry/projection'
import type { Scene } from '../../../geometry/scene'
import type { Preview } from '../Overlay'

/** One pointer event, in every coordinate space a gesture may need. */
export interface PointerPoint {
  clientX: number
  clientY: number
  /** Container-relative screen px. */
  local: Vec2
  /** Scene (projected) px, before the viewport transform. */
  scene: Vec2
  /** Ground-grid units. */
  world: Vec2
  shift: boolean
  alt: boolean
  /** Ctrl or Cmd: free movement without snapping. */
  mod: boolean
}

export interface GestureContext {
  scene: Scene
  setPreview: (p: Preview | null) => void
}

/** A drag in progress, from pointer down to pointer up. Each kind of drag is its own strategy. */
export interface Gesture {
  /** Panning shows the grabbing cursor. */
  readonly panning?: boolean
  move(p: PointerPoint, ctx: GestureContext): void
  end(p: PointerPoint, ctx: GestureContext): void
}

/** Grid step for a drag: whole cells, or fine steps with Mod held. */
export const snapStep = (p: PointerPoint) => (p.mod ? 0.05 : 1)

/** A press only becomes a drag after the pointer has moved this far (px). */
export const DRAG_THRESHOLD = 3
export const dragged = (from: Vec2, to: Vec2) => Math.hypot(to.x - from.x, to.y - from.y) >= DRAG_THRESHOLD
