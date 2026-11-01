import { produce, type Draft } from 'immer'
import { create } from 'zustand'
import type { Doc } from '../model/schema'

const MAX_HISTORY = 200
/** Edits with the same coalesce key this close together form one undo step. */
const COALESCE_MS = 1200

interface DocState {
  doc: Doc | null
  past: Doc[]
  future: Doc[]
  /** Increments on every change; used for autosave and dirty tracking. */
  revision: number
  /** Revision last written to disk. */
  savedRevision: number
  /** Snapshot taken when a drag/gesture starts; committed as one undo step. */
  txBase: Doc | null
  /** Opened from a share link: never autosaved, not in the recent list. */
  ephemeral: boolean
  /** Key and time of the last coalescing edit. */
  lastEdit: { key: string; at: number }

  load: (doc: Doc, saved?: boolean, opts?: { ephemeral?: boolean }) => void
  /** Apply a change. Records an undo step unless a transaction is open or `history` is false. */
  update: (recipe: (d: Draft<Doc>) => void, opts?: { history?: boolean; coalesce?: string }) => void
  begin: () => void
  commit: () => void
  cancel: () => void
  undo: () => void
  redo: () => void
  markSaved: () => void
}

export const useDocStore = create<DocState>((set, get) => ({
  doc: null,
  past: [],
  future: [],
  revision: 0,
  savedRevision: 0,
  txBase: null,
  ephemeral: false,
  lastEdit: { key: '', at: 0 },

  load: (doc, saved = true, opts) =>
    set((s) => ({ doc, past: [], future: [], txBase: null, ephemeral: !!opts?.ephemeral, revision: s.revision + 1, savedRevision: saved ? s.revision + 1 : s.savedRevision })),

  update: (recipe, opts) => {
    const { doc, txBase, past, revision, lastEdit } = get()
    if (!doc) return
    const next = produce(doc, recipe)
    if (next === doc) return
    // Typing into a field creates one undo step, not one per keystroke.
    const now = Date.now()
    const merged = !!opts?.coalesce && lastEdit.key === opts.coalesce && now - lastEdit.at < COALESCE_MS
    const record = opts?.history !== false && !txBase && !merged
    set({
      doc: next,
      revision: revision + 1,
      lastEdit: { key: opts?.coalesce ?? '', at: now },
      ...(record ? { past: [...past, doc].slice(-MAX_HISTORY), future: [] } : {}),
    })
  },

  begin: () => {
    const { doc, txBase } = get()
    if (doc && !txBase) set({ txBase: doc })
  },
  commit: () => {
    const { doc, txBase, past } = get()
    if (!txBase) return
    if (doc === txBase) set({ txBase: null })
    else set({ txBase: null, past: [...past, txBase].slice(-MAX_HISTORY), future: [] })
  },
  cancel: () => {
    const { txBase, revision } = get()
    if (txBase) set({ doc: txBase, txBase: null, revision: revision + 1 })
  },

  undo: () => {
    const { doc, past, future, revision, txBase } = get()
    if (!doc || !past.length || txBase) return
    set({ doc: past[past.length - 1], past: past.slice(0, -1), future: [doc, ...future], revision: revision + 1 })
  },
  redo: () => {
    const { doc, past, future, revision, txBase } = get()
    if (!doc || !future.length || txBase) return
    set({ doc: future[0], future: future.slice(1), past: [...past, doc], revision: revision + 1 })
  },
  markSaved: () => set((s) => ({ savedRevision: s.revision })),
}))

