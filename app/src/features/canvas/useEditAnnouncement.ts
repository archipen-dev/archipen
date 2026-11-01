import { useEffect, useRef, useState } from 'react'
import { describeChanges } from '../../render/describe'
import type { A11yItem } from '../../render/mode'

/** Wait this long after the last edit, so a drag or typing in a panel is announced once. */
const SETTLE_MS = 600

/**
 * The text for the canvas's live region: what the last edit changed (also undo and redo),
 * or which page opened. `page` is the page on screen; its name is announced when it changes.
 */
export function useEditAnnouncement(docId: string, page: { id: string; name: string }, items: Map<string, A11yItem>): string {
  const [message, setMessage] = useState('')
  const baseline = useRef({ docId, pageId: page.id, items })

  useEffect(() => {
    // Another document was opened: nothing to announce. Another page: say which.
    if (baseline.current.docId !== docId || baseline.current.pageId !== page.id) {
      if (baseline.current.docId === docId) setMessage(`Page ${page.name.trim() || 'Untitled page'}`)
      baseline.current = { docId, pageId: page.id, items }
      return
    }
    if (baseline.current.items === items) return
    const timer = setTimeout(() => {
      const text = describeChanges(baseline.current.items, items)
      baseline.current = { docId, pageId: page.id, items }
      if (text) setMessage(text)
    }, SETTLE_MS)
    return () => clearTimeout(timer)
  }, [docId, page.id, page.name, items])

  return message
}
