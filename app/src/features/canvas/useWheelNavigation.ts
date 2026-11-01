import { useEffect, type RefObject } from 'react'
import { zoomAt } from '../../geometry/viewport'
import { useUi } from '../../store/uiStore'

const LINE_PX = 16
const ZOOM_SPEED = 0.006

/** Wheel pans, Ctrl/Cmd+wheel and pinch zoom around the pointer — like Figma. */
export function useWheelNavigation(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const el = ref.current!
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const ui = useUi.getState()
      const v = ui.viewport
      let dx = e.deltaX
      let dy = e.deltaY
      if (e.deltaMode === WheelEvent.DOM_DELTA_LINE) ((dx *= LINE_PX), (dy *= LINE_PX))
      if (e.ctrlKey || e.metaKey) {
        const r = el.getBoundingClientRect()
        const factor = Math.exp(-Math.max(-50, Math.min(50, dy)) * ZOOM_SPEED)
        ui.setViewport(zoomAt(v, factor, e.clientX - r.left, e.clientY - r.top))
      } else {
        if (e.shiftKey && dx === 0) ((dx = dy), (dy = 0))
        ui.setViewport({ ...v, x: v.x - dx, y: v.y - dy })
      }
    }
    // Safari pinch gestures
    const prevent = (e: Event) => e.preventDefault()
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('gesturestart', prevent)
    return () => {
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('gesturestart', prevent)
    }
  }, [ref])
}
