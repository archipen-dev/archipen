import { history, mutatePage } from '../../../commands/mutate'
import { followLink } from '../../../commands/pages'
import { snap } from '../../../geometry/projection'
import { recomputeMembership } from '../../../model/membership'
import { applyMove } from '../../../model/ops'
import type { Layer } from '../../../model/schema'
import { useUi } from '../../../store/uiStore'
import { dragged, snapStep, type Gesture, type PointerPoint } from './types'

/**
 * Drag the selection. Positions are always computed from `base`, so the move never drifts.
 * A press without movement on one of several selected items selects just that item.
 * Ctrl/Cmd+click without movement opens the page the item links to.
 */
export function moveGesture(start: PointerPoint, opts: { ids: Set<string>; base: Layer; clickId: string }): Gesture {
  let moved = false
  return {
    move(p) {
      if (!moved && !dragged(start.local, p.local)) return
      if (!moved) {
        moved = true
        history.begin()
      }
      const step = snapStep(p)
      const dx = snap(p.world.x - start.world.x, step)
      const dy = snap(p.world.y - start.world.y, step)
      mutatePage((d) => applyMove(d, opts.base, opts.ids, dx, dy))
    },
    end() {
      if (moved) mutatePage((d) => recomputeMembership(d))
      history.commit()
      if (moved || start.shift) return
      if (start.mod && followLink(opts.clickId)) return
      const ui = useUi.getState()
      if (ui.selection.length > 1) ui.select([opts.clickId])
    },
  }
}
