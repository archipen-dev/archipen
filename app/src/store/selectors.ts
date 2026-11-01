import { useMemo } from 'react'
import { pageById, pageView } from '../model/pages'
import type { Doc, PageDoc } from '../model/schema'
import { useDocStore } from './docStore'
import { useUi } from './uiStore'

/** The open document. Only for components rendered once a document is loaded. */
export function useDoc(): Doc {
  const doc = useDocStore((s) => s.doc)
  if (!doc) throw new Error('No diagram is open')
  return doc
}

export const useIsDirty = () => useDocStore((s) => s.revision !== s.savedRevision)
export const useCanUndo = () => useDocStore((s) => s.past.length > 0)
export const useCanRedo = () => useDocStore((s) => s.future.length > 0)
/** True while a drag or other gesture is changing the document (one undo step, not committed yet). */
export const useGestureOpen = () => useDocStore((s) => s.txBase !== null)

/** The open document outside React. Commands no-op when nothing is open. */
export const getDoc = () => useDocStore.getState().doc

/** Id of the page on screen (the first page when the stack names none or a page that's gone). */
export const currentPageId = (doc: Doc, stack: string[] = useUi.getState().pageStack) => pageById(doc, stack.at(-1)).id

/** The page on screen, as a document. Only for components rendered once a document is loaded. */
export function usePage(): PageDoc {
  const doc = useDoc()
  const top = useUi((s) => s.pageStack.at(-1))
  return pageView(doc, top)
}

/** Page id → name, for link descriptions. Stable while the pages keep their ids and names. */
export function usePageNames(): ReadonlyMap<string, string> {
  const key = useDocStore((s) => JSON.stringify(s.doc?.pages.map((p) => [p.id, p.name]) ?? []))
  return useMemo(() => new Map(JSON.parse(key) as [string, string][]), [key])
}

/** The page on screen outside React. */
export const getPage = (): PageDoc | null => {
  const doc = getDoc()
  return doc ? pageView(doc, useUi.getState().pageStack.at(-1)) : null
}
