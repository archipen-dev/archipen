import { addZone } from '../../../commands/create'
import { snap, type Vec2 } from '../../../geometry/projection'
import { rectAt } from '../../../geometry/shapes'
import { useUi } from '../../../store/uiStore'
import type { Gesture, PointerPoint } from './types'

/** A click without a drag makes a zone of this size around the point. */
const CLICK_ZONE = { w: 8, d: 6 }

const snapped = (p: PointerPoint): Vec2 => ({ x: snap(p.world.x, 1), y: snap(p.world.y, 1) })
const boxBetween = (a: Vec2, b: Vec2) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(b.x - a.x), d: Math.abs(b.y - a.y) })

/** Draw a zone corner to corner, on whole grid cells. */
export function drawZoneGesture(start: PointerPoint): Gesture {
  const a = snapped(start)
  return {
    move(p, { scene, setPreview }) {
      setPreview({ type: 'zone', poly: rectAt({ ...boxBetween(a, snapped(p)), h: 0 }, 0, scene.projection) })
    },
    end(p) {
      let box = boxBetween(a, snapped(p))
      if (box.w < 1 || box.d < 1) box = { x: a.x - CLICK_ZONE.w / 2, y: a.y - CLICK_ZONE.d / 2, ...CLICK_ZONE }
      const ui = useUi.getState()
      ui.select([addZone(box.x, box.y, box.w, box.d)])
      ui.setTool('select')
    },
  }
}
