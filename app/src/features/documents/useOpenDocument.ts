import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { useCallback } from 'react'
import { storeDoc } from '../../io/autosave'
import type { Doc } from '../../model/schema'
import { useDocStore } from '../../store/docStore'
import type { Mode } from '../../store/uiStore'

export const RECENT_KEY = ['recent'] as const

export interface OpenOptions {
  /** The document has changes not on disk (new, or a copy). */
  dirty: boolean
  mode: Mode
}

/** Keep a document in this browser, make it the open one, and go to its editor. */
export function useOpenDocument() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  return useCallback(
    async (doc: Doc, { dirty, mode }: OpenOptions) => {
      await storeDoc(doc, dirty)
      useDocStore.getState().load(doc, !dirty)
      await qc.invalidateQueries({ queryKey: RECENT_KEY })
      await navigate({ to: '/d/$docId', params: { docId: doc.id }, search: { mode } })
    },
    [qc, navigate],
  )
}
