import { marqueeHits } from '../../../geometry/hit'
import { followLink } from '../../../commands/pages'
import { lockedIds } from '../../../model/visibility'
import { getPage } from '../../../store/selectors'
import { useUi } from '../../../store/uiStore'
import { dragged, type Gesture, type PointerPoint } from './types'

/**
 * Rubber-band selection, added to `base`. A press without movement selects `clickId`
 * (used for zone bodies, which start a marquee rather than a move); with Ctrl/Cmd it opens the page `clickId` links to.
 */
export function marqueeGesture(start: PointerPoint, opts: { base: string[]; clickId: string | null }): Gesture {
  let moved = false
  return {
    move(p, { scene, setPreview }) {
      if (!moved && !dragged(start.local, p.local)) return
      moved = true
      const a = start.scene
      const b = p.scene
      const r = { x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), h: Math.abs(b.y - a.y) }
      setPreview({ type: 'marquee', ...r })
      const locked = lockedIds(getPage()!)
      const hits = marqueeHits(scene, r).filter((id) => !locked.has(id))
      useUi.getState().select([...new Set([...opts.base, ...hits])])
    },
    end() {
      if (moved || !opts.clickId) return
      if (start.mod && followLink(opts.clickId)) return
      useUi.getState().select([opts.clickId])
    },
  }
}
