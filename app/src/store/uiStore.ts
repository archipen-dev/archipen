import { create } from 'zustand'
import type { Viewport } from '../geometry/viewport'
import type { Settings } from '../model/schema'

type Projection = Settings['projection']

export type { Viewport }

export type Tool = 'select' | 'hand' | 'node' | 'zone' | 'connect' | 'text' | 'note'
export type Mode = 'edit' | 'view'
export type DialogId = 'settings' | 'shortcuts' | 'ai'

export interface Size {
  w: number
  h: number
}

interface UiState {
  tool: Tool
  mode: Mode
  selection: string[]
  hoverId: string | null
  editingId: string | null
  viewport: Viewport
  /** The last view of each projection, so switching back returns to it. Reset when another page or document opens. */
  savedViewports: Partial<Record<Projection, Viewport>>
  /** Size of the canvas element, kept by the canvas. */
  canvasSize: Size
  spaceDown: boolean
  dialog: DialogId | null
  /** Full-screen presentation: no chrome, click to focus an item. */
  presenting: boolean
  /**
   * Pages opened on the way to the current one (the page history after the first page, for going back).
   * Empty: the first page. The last entry is the page on screen.
   */
  pageStack: string[]

  setTool: (t: Tool) => void
  setMode: (m: Mode) => void
  /** Apply the route's mode: edit/view, and whether presenting. */
  applyRouteMode: (mode: Mode, presenting: boolean) => void
  select: (ids: string[]) => void
  toggleSelect: (id: string) => void
  setHover: (id: string | null) => void
  setEditing: (id: string | null) => void
  setViewport: (v: Viewport) => void
  saveViewport: (projection: Projection, v: Viewport) => void
  clearSavedViewports: () => void
  setCanvasSize: (s: Size) => void
  setSpaceDown: (down: boolean) => void
  openDialog: (d: DialogId) => void
  closeDialog: () => void
  setPresenting: (on: boolean) => void
  /** Show another page. Clears the selection. */
  setPageStack: (stack: string[]) => void
}

export const useUi = create<UiState>((set, get) => ({
  tool: 'select',
  mode: 'edit',
  selection: [],
  hoverId: null,
  editingId: null,
  viewport: { x: 0, y: 0, zoom: 1 },
  savedViewports: {},
  canvasSize: { w: 1200, h: 800 },
  spaceDown: false,
  dialog: null,
  presenting: false,
  pageStack: [],

  setTool: (tool) => set({ tool }),
  setMode: (mode) => set({ mode, tool: 'select', editingId: null }),
  applyRouteMode: (mode, presenting) => {
    if (get().mode !== mode) get().setMode(mode)
    set({ presenting, ...(mode === 'view' ? { editingId: null } : {}), ...(presenting ? { selection: [] } : {}) })
  },
  select: (selection) => set({ selection }),
  toggleSelect: (id) => set((s) => ({ selection: s.selection.includes(id) ? s.selection.filter((x) => x !== id) : [...s.selection, id] })),
  setHover: (hoverId) => set({ hoverId }),
  setEditing: (editingId) => set({ editingId }),
  setViewport: (viewport) => set({ viewport }),
  saveViewport: (projection, v) => set((s) => ({ savedViewports: { ...s.savedViewports, [projection]: v } })),
  clearSavedViewports: () => set({ savedViewports: {} }),
  setCanvasSize: (canvasSize) => set({ canvasSize }),
  setSpaceDown: (spaceDown) => get().spaceDown !== spaceDown && set({ spaceDown }),
  openDialog: (dialog) => set({ dialog }),
  closeDialog: () => set({ dialog: null }),
  setPresenting: (presenting) => set({ presenting }),
  setPageStack: (pageStack) => set({ pageStack, selection: [], hoverId: null, editingId: null, savedViewports: {} }),
}))

/** Whether a side panel covers the right of the canvas. */
export const hasSidePanel = (s: Pick<UiState, 'mode' | 'selection'>) => (s.mode === 'edit' ? s.selection.length > 0 : s.selection.length === 1)
