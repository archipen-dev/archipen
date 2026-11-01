import { useBlocker } from '@tanstack/react-router'
import { useDocStore } from '../../store/docStore'

/** Ask before leaving a diagram whose changes aren't saved to a file, like the tab-close warning in `useAutosave`. */
export function useLeaveGuard() {
  useBlocker({
    enableBeforeUnload: false,
    shouldBlockFn: ({ next }) => {
      const { doc, revision, savedRevision, ephemeral } = useDocStore.getState()
      if (!doc || ephemeral || revision === savedRevision) return false
      // Same diagram (mode, page) or one just opened by `useOpenDocument`, which loads it before navigating.
      if (next.routeId === '/d/$docId' && next.params.docId === doc.id) return false
      return !confirm(`“${doc.name}” has changes that aren’t saved to a file. Leave anyway?`)
    },
  })
}
