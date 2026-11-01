import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Editor, pageParam, useRoutePage, useRouteMode, type RouteMode } from '../features/editor'
import { loadStoredDoc } from '../io/autosave'
import { useDocStore } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { Loading, Notice } from '../ui'

export const Route = createFileRoute('/d/$docId')({
  validateSearch: (s: Record<string, unknown>): { mode: RouteMode; page?: string } => ({ mode: s.mode === 'present' ? 'present' : 'edit', ...pageParam(s) }),
  component: EditorPage,
})

/** Whether the store already holds this browser-stored diagram. */
const isOpen = (docId: string) => {
  const s = useDocStore.getState()
  return s.doc?.id === docId && !s.ephemeral
}

/** A diagram stored in this browser. Opens from the store if it's already loaded, else from IndexedDB. */
function EditorPage() {
  const { docId } = Route.useParams()
  const { mode, page } = Route.useSearch()
  const ready = useDocStore((s) => s.doc?.id === docId && !s.ephemeral)
  const q = useQuery({
    queryKey: ['doc', docId],
    queryFn: async () => {
      const s = useDocStore.getState()
      if (isOpen(docId)) return { doc: s.doc!, dirty: s.revision !== s.savedRevision }
      return loadStoredDoc(docId)
    },
    staleTime: Infinity,
    gcTime: 0,
  })

  useEffect(() => {
    if (q.data && !isOpen(docId)) {
      useDocStore.getState().load(q.data.doc, !q.data.dirty)
      useUi.getState().select([])
    }
  }, [q.data, docId])

  useRouteMode(mode)
  useRoutePage(page, ready)

  if (q.isPending) return <Loading>Loading…</Loading>
  if (q.isError || !q.data)
    return (
      <Notice title="Diagram not found" action={<Link to="/">← All diagrams</Link>}>
        It may have been removed from this browser. Open the file from disk instead.
      </Notice>
    )
  if (!ready) return null
  return <Editor />
}
