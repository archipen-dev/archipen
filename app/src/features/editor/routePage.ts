import { useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { useDocStore } from '../../store/docStore'
import { useUi } from '../../store/uiStore'

/** Read the optional `page` search param of the diagram routes. */
export const pageParam = (s: Record<string, unknown>): { page?: string } => (typeof s.page === 'string' && s.page ? { page: s.page } : {})

/**
 * Keep the `page` search param and the page on screen in step, so a reload or a copied
 * link opens the same page. The first page has no param. `ready`: the route's diagram is in the store.
 */
export function useRoutePage(page: string | undefined, ready: boolean) {
  const navigate = useNavigate()
  const docId = useDocStore((s) => s.doc?.id)

  // URL → screen: on open, and when the param changes (browser back/forward).
  useEffect(() => {
    const doc = useDocStore.getState().doc
    const ui = useUi.getState()
    if (!doc || !ready) return
    const top = ui.pageStack.at(-1)
    const alive = ui.pageStack.every((id) => doc.pages.some((p) => p.id === id))
    if (top === page && alive) return
    if (!page || page === doc.pages[0].id || !doc.pages.some((p) => p.id === page)) ui.setPageStack([])
    else {
      const i = ui.pageStack.indexOf(page)
      ui.setPageStack(alive && i >= 0 ? ui.pageStack.slice(0, i + 1) : [page])
    }
    // oxlint-disable-next-line react/exhaustive-deps -- docId is a trigger: another diagram opened
  }, [page, docId, ready])

  // Screen → URL.
  const top = useUi((s) => s.pageStack.at(-1))
  useEffect(() => {
    if (!ready || useUi.getState().pageStack.at(-1) === page) return
    void navigate({ to: '.', search: (s: Record<string, unknown>) => ({ ...s, page: top }), hash: true, replace: true } as never)
  }, [top, page, ready, navigate])
}
