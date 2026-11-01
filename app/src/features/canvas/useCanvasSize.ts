import { useLayoutEffect, type RefObject } from 'react'
import { useUi } from '../../store/uiStore'

/** Keep the UI store's canvas size in step with the element (used to fit and zoom around the centre). */
export function useCanvasSize(ref: RefObject<HTMLElement | null>) {
  // A layout effect that measures right away: the editor fits the diagram on open, before the observer first reports.
  useLayoutEffect(() => {
    const el = ref.current!
    const measure = () => {
      const r = el.getBoundingClientRect()
      useUi.getState().setCanvasSize({ w: r.width, h: r.height })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
}
