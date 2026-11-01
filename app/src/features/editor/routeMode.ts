import { useNavigate } from '@tanstack/react-router'
import { useCallback, useEffect } from 'react'
import { useUi, type Mode } from '../../store/uiStore'

/** `mode` search param of the diagram routes. */
export type RouteMode = Mode | 'present'

/** Apply the route's `mode` to the UI store. Shared diagrams are never editable. */
export function useRouteMode(mode: RouteMode, shared = false) {
  useEffect(() => {
    useUi.getState().applyRouteMode(mode === 'edit' && !shared ? 'edit' : 'view', mode === 'present')
  }, [mode, shared])
  useEffect(() => () => useUi.getState().setPresenting(false), [])
}

/** Change the current route's `mode`, keeping its other search params. */
export function useSetRouteMode() {
  const navigate = useNavigate()
  return useCallback(
    (mode: RouteMode) => void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, mode }), hash: true, replace: true } as never),
    [navigate],
  )
}
