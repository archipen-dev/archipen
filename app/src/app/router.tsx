import { QueryClient } from '@tanstack/react-query'
import { createHashHistory, createRouter } from '@tanstack/react-router'
import { routeTree } from '../routeTree.gen'
import { Notice } from '../ui'

export const queryClient = new QueryClient({ defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } } })

// Hash routing (`…/#/d/<id>`): the server only ever serves index.html from one folder, so the
// same build works under any URL path without a base path or SPA fallback.
export const router = createRouter({
  routeTree,
  history: createHashHistory(),
  defaultPreload: 'intent',
  context: { queryClient },
  defaultErrorComponent: ({ error }) => (
    <Notice title="Something broke." action={<a href="#/">← All diagrams</a>}>
      <p>{error instanceof Error ? error.message : String(error)}</p>
      <p className="mt-1 text-[12px] text-ink-faint">Your work is autosaved in this browser.</p>
    </Notice>
  ),
  defaultNotFoundComponent: () => <Notice action={<a href="#/">Page not found — back to all diagrams</a>} />,
})

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
