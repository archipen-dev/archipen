import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useDocumentActions, type DocumentActions } from '../documents'
import { useKeymap } from '../../keyboard/useKeymap'
import { useFitWhileBare, usePresentation, type PresentationControls } from './usePresentation'

export interface EditorActions extends DocumentActions {
  present: PresentationControls
  /** A shared (link) diagram: read-only, can be saved as a copy. */
  shared: boolean
}

const Ctx = createContext<EditorActions | null>(null)

/**
 * Creates the editor's actions once and shares them: the top bar, keyboard shortcuts and
 * file drop all use the same mutations, so their pending states agree.
 */
export function EditorActionsProvider({ shared, children }: { shared: boolean; children: ReactNode }) {
  const docs = useDocumentActions()
  const present = usePresentation()
  const value = useMemo(() => ({ ...docs, present, shared }), [docs, present, shared])

  useFitWhileBare(present)
  useKeymap({
    save: (saveAs) => docs.save.mutate(saveAs),
    open: () => docs.open.mutate(),
    enterPresentation: present.enter,
    exitPresentation: present.exit,
  })

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useEditorActions(): EditorActions {
  const v = useContext(Ctx)
  if (!v) throw new Error('useEditorActions must be used inside EditorActionsProvider')
  return v
}
