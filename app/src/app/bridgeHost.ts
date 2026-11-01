// Lets the AI bridge (commands/bridge.ts) see which screen is showing and switch diagrams through the router.
import { setBridgeHost } from '../commands/bridge'
import { RECENT_KEY } from '../features/documents'
import { queryClient, router } from './router'

export function installBridgeHost() {
  setBridgeHost({
    screen: () => {
      const matches = router.state.matches
      const editor = matches.find((m) => m.routeId === '/d/$docId')
      if (editor) return { kind: 'editor', docId: (editor.params as { docId: string }).docId }
      if (matches.some((m) => m.routeId === '/share')) return { kind: 'share' }
      return { kind: 'other' }
    },
    openEditor: (docId) => router.navigate({ to: '/d/$docId', params: { docId }, search: { mode: 'edit' } }),
    refreshRecent: () => queryClient.invalidateQueries({ queryKey: RECENT_KEY }),
  })
}
