import { followLink } from '../../../commands/pages'
import { useUi } from '../../../store/uiStore'
import type { Gesture, PointerPoint } from './types'

/**
 * Drag the view. In view mode a press without movement is a click: it opens the page `clickId` links to,
 * or else selects it.
 */
export function panGesture(start: PointerPoint, clickId: string | null): Gesture {
  const v0 = useUi.getState().viewport
  let moved = false
  return {
    panning: true,
    move(p) {
      const dx = p.local.x - start.local.x
      const dy = p.local.y - start.local.y
      if (Math.abs(dx) + Math.abs(dy) > 3) moved = true
      const ui = useUi.getState()
      ui.setViewport({ ...ui.viewport, x: v0.x + dx, y: v0.y + dy })
    },
    end() {
      const ui = useUi.getState()
      if (moved || ui.mode !== 'view') return
      if (!clickId || !followLink(clickId)) ui.select(clickId ? [clickId] : [])
    },
  }
}
