import { useQuery } from '@tanstack/react-query'
import { createFileRoute, Link, useLocation } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Editor, pageParam, useRoutePage, useRouteMode, type RouteMode } from '../features/editor'
import { decodeDoc } from '../io/shareLink'
import { useDocStore } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { Loading, Notice } from '../ui'

/** Read-only view of a diagram carried entirely in the link's #fragment. */
export const Route = createFileRoute('/share')({
  validateSearch: (s: Record<string, unknown>): { mode: RouteMode; page?: string } => ({ mode: s.mode === 'present' ? 'present' : 'view', ...pageParam(s) }),
  component: SharePage,
})

function SharePage() {
  const { mode, page } = Route.useSearch()
  const hash = useLocation({ select: (l) => l.hash })
  const q = useQuery({ queryKey: ['share', hash], queryFn: () => decodeDoc(hash), enabled: !!hash, staleTime: Infinity, retry: false })
  const ready = useDocStore((s) => s.ephemeral && !!q.data && s.doc?.id === q.data.id)

  useEffect(() => {
    if (!q.data) return
    useDocStore.getState().load(q.data, true, { ephemeral: true })
    useUi.getState().select([])
  }, [q.data])

  useRouteMode(mode, true)
  useRoutePage(page, ready)

  if (!hash || q.isError)
    return (
      <Notice title="Can’t open this link" action={<Link to="/">← Go to Archipen</Link>}>
        {q.error ? q.error.message : 'This link doesn’t contain a diagram.'}
      </Notice>
    )
  if (q.isPending || !ready) return <Loading>Opening shared diagram…</Loading>
  return <Editor shared />
}
