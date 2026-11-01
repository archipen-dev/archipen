import { useMutation } from '@tanstack/react-query'
import { useMemo } from 'react'
import { EXPORTERS, type ExportKind } from '../../io/exporters'
import { downloadBlob, openDiagramFile, saveDiagramFile } from '../../io/fileIO'
import { LONG_LINK, shareUrl } from '../../io/shareLink'
import { errorMessage, isAbortError } from '../../lib/dom'
import { newId } from '../../model/ids'
import type { Doc } from '../../model/schema'
import { useDocStore } from '../../store/docStore'
import { currentPageId, getDoc } from '../../store/selectors'
import { usePrefs } from '../../store/prefsStore'
import { useCanvasTheme } from '../../store/theme'
import { toast } from '../../store/toastStore'
import { useUi } from '../../store/uiStore'
import { useOpenDocument } from './useOpenDocument'

/** Report failures, except the user closing a file picker. */
export const reportError = (e: unknown) => !isAbortError(e) && toast(errorMessage(e), 'error')

function requireDoc(what: string): Doc {
  const doc = getDoc()
  if (!doc) throw new Error(`Nothing to ${what}`)
  return doc
}

/** Save, open, export, share and copy the open document. */
export function useDocumentActions() {
  const theme = useCanvasTheme()
  const openDocument = useOpenDocument()

  const save = useMutation({
    mutationFn: async (saveAs: boolean) => {
      const { revision } = useDocStore.getState()
      const name = await saveDiagramFile(requireDoc('save'), saveAs)
      return { name, revision }
    },
    onSuccess: ({ name, revision }) => {
      // Only mark the revision actually written: edits made while the dialog was open stay unsaved.
      useDocStore.setState({ savedRevision: revision })
      toast(`Saved ${name ?? ''}`.trim())
    },
    onError: reportError,
  })

  const open = useMutation({
    mutationFn: async () => openDocument(await openDiagramFile(), { dirty: false, mode: useUi.getState().mode }),
    onError: reportError,
  })

  const exportFile = useMutation({
    mutationFn: async (kind: ExportKind) => {
      const doc = requireDoc('export')
      const { blob, filename } = await EXPORTERS[kind].run(doc, theme, { page: currentPageId(doc), all: usePrefs.getState().exportPages === 'all' })
      downloadBlob(blob, filename)
      return kind
    },
    onSuccess: (kind) => toast(`${EXPORTERS[kind].format} exported`),
    onError: reportError,
  })

  const share = useMutation({
    mutationFn: async () => {
      const url = await shareUrl(requireDoc('share'))
      await navigator.clipboard.writeText(url)
      return url.length
    },
    onSuccess: (length) => {
      const kb = Math.max(1, Math.round(length / 1024))
      if (length > LONG_LINK) toast(`Link copied (${kb} KB). That's long — some apps may cut it off; large custom icons are the usual cause.`, 'error')
      else toast(`Read-only link copied · ${kb} KB`)
    },
    onError: reportError,
  })

  /** Keep a shared (link) diagram: store it as a new diagram in this browser and open it for editing. */
  const saveCopy = useMutation({
    mutationFn: async () => {
      const copy = { ...requireDoc('save'), id: newId('d') }
      await openDocument(copy, { dirty: true, mode: 'edit' })
      return copy.name
    },
    onSuccess: (name) => toast(`Saved “${name}” to your diagrams`),
    onError: reportError,
  })

  return useMemo(() => ({ save, open, exportFile, share, saveCopy }), [save, open, exportFile, share, saveCopy])
}

export type DocumentActions = ReturnType<typeof useDocumentActions>
