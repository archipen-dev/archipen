import { useCallback, useEffect, useMemo } from 'react'
import { fitAll } from '../../commands/view'
import { afterLayout } from '../../lib/dom'
import { useDocStore } from '../../store/docStore'
import { useUi } from '../../store/uiStore'
import { useSetRouteMode } from './routeMode'

export interface PresentationControls {
  enter: () => void
  exit: () => void
}

/** Enter and leave presentation (full screen, no chrome). Leaving returns to editing, or to viewing a shared diagram. */
export function usePresentation(): PresentationControls {
  const setRouteMode = useSetRouteMode()

  const enter = useCallback(() => {
    useUi.getState().select([])
    setRouteMode('present')
    document.documentElement.requestFullscreen?.().catch(() => {
      /* not allowed here (e.g. no user gesture): present inside the window instead */
    })
  }, [setRouteMode])

  const exit = useCallback(() => {
    setRouteMode(useDocStore.getState().ephemeral ? 'view' : 'edit')
    useUi.getState().select([])
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
    afterLayout(fitAll)
  }, [setRouteMode])

  return useMemo(() => ({ enter, exit }), [enter, exit])
}

/**
 * Presenting: fit once the browser has gone full screen,
 * and on every resize. Leaving full screen (Esc in the browser) ends the presentation.
 */
export function useFitWhileBare(present: PresentationControls) {
  const presenting = useUi((s) => s.presenting)
  useEffect(() => {
    if (!presenting) return
    const refit = () => afterLayout(fitAll)
    refit()
    window.addEventListener('resize', refit)
    const onFullscreen = () => !document.fullscreenElement && useUi.getState().presenting && present.exit()
    document.addEventListener('fullscreenchange', onFullscreen)
    return () => {
      window.removeEventListener('resize', refit)
      document.removeEventListener('fullscreenchange', onFullscreen)
    }
  }, [presenting, present])
}

/** Fit the diagram whenever another document, or another page of it, opens in this editor. */
export function useFitOnOpen(docId: string) {
  const page = useUi((s) => s.pageStack.at(-1))
  useEffect(() => {
    useUi.getState().clearSavedViewports()
    const id = requestAnimationFrame(fitAll)
    return () => cancelAnimationFrame(id)
    // oxlint-disable-next-line react/exhaustive-deps -- docId and page are the triggers, not inputs
  }, [docId, page])
}
