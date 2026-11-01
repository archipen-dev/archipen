// Requests from the local MCP server (see io/bridgeProtocol.ts), answered from the diagram on screen.
// A change from the AI is one undo step, like any edit made by hand.
import { listStoredDocs, loadStoredDoc, storeDoc } from '../io/autosave'
import type { BridgeRequest, CreateParams, DiagramSummary, ReplaceParams, TabState, TabStatus } from '../io/bridgeProtocol'
import { emptyDoc, parseDoc } from '../model/defaults'
import { findEntity } from '../model/entities'
import { newId } from '../model/ids'
import type { Doc } from '../model/schema'
import { useDocStore } from '../store/docStore'
import { currentPageId, getDoc } from '../store/selectors'
import { useUi } from '../store/uiStore'

/** What the bridge needs from the router; set up in app/bridgeHost.ts, faked in tests. */
export interface BridgeHost {
  /** The screen on show: a diagram's editor (with its id), a share link, or anything else. */
  screen(): { kind: 'editor'; docId: string } | { kind: 'share' } | { kind: 'other' }
  /** Go to the editor of a diagram that is already loaded into the document store. */
  openEditor(docId: string): Promise<void>
  /** The start page's list of diagrams changed. */
  refreshRecent(): Promise<void>
}

let host: BridgeHost | null = null
export const setBridgeHost = (h: BridgeHost) => void (host = h)

const NO_DIAGRAM = 'No diagram is open in the editor. Use new_diagram to create one, or list_diagrams and open_diagram to open one.'

/** The diagram on screen, or null when the tab shows the start page (the store may still hold the last one). */
function shownDoc(): Doc | null {
  const doc = getDoc()
  const screen = host?.screen() ?? { kind: 'editor', docId: doc?.id ?? '' }
  if (!doc) return null
  if (screen.kind === 'editor') return doc.id === screen.docId ? doc : null
  if (screen.kind === 'share') return useDocStore.getState().ephemeral ? doc : null
  return null
}

function openDoc(): Doc {
  const doc = shownDoc()
  if (!doc) throw new Error(NO_DIAGRAM)
  return doc
}

const readOnlyReason = () => {
  const store = useDocStore.getState()
  const ui = useUi.getState()
  if (store.ephemeral) return 'This diagram was opened from a share link and is read-only. Use new_diagram or open_diagram to work on another one.'
  if (ui.mode !== 'edit' || ui.presenting) return 'The editor is not in edit mode (it is presenting or read-only).'
  return null
}

export function bridgeStatus(): TabStatus {
  const doc = shownDoc()
  const screen = host?.screen().kind ?? (doc ? 'editor' : 'other')
  return { screen, diagram: doc && { id: doc.id, name: doc.name }, revision: useDocStore.getState().revision, readOnly: !doc || readOnlyReason() !== null }
}

export function bridgeGet(): TabState {
  const doc = openDoc()
  const { revision, ephemeral } = useDocStore.getState()
  const ui = useUi.getState()
  return { doc, revision, pageId: currentPageId(doc), selection: ui.selection, mode: ui.mode, presenting: ui.presenting, ephemeral }
}

export function bridgeReplace({ doc: raw, expectRevision }: ReplaceParams): { revision: number } {
  const current = openDoc()
  const store = useDocStore.getState()
  const ui = useUi.getState()
  const refused = readOnlyReason()
  if (refused) throw new Error(refused)
  if (store.txBase) throw new Error('The user is dragging something right now. Try again in a moment.')
  if (expectRevision !== undefined && expectRevision !== store.revision)
    throw new Error(`The diagram changed in the editor (revision ${store.revision}, expected ${expectRevision}). Get it again and redo the change.`)

  // Checked again here: the tab never trusts outside input, and this also cleans custom icon markup.
  const next = parseDoc(raw)
  next.id = current.id
  // Returning a value from the recipe makes Immer replace the whole document.
  store.update(() => next as never)
  ui.select(ui.selection.filter((id) => findEntity(next, id)))
  return { revision: useDocStore.getState().revision }
}

const summary = (doc: Doc, updatedAt?: string): DiagramSummary => ({ id: doc.id, name: doc.name, pages: doc.pages.length, updatedAt, open: shownDoc()?.id === doc.id })

export async function bridgeList(): Promise<DiagramSummary[]> {
  return (await listStoredDocs()).map((s) => summary(s.doc, s.updatedAt))
}

/** Show `doc` in the editor, like opening it from the start page. Keeps the diagram on screen saved first. */
async function show(doc: Doc, dirty: boolean): Promise<DiagramSummary> {
  if (!host) throw new Error('This tab cannot switch diagrams.')
  if (useDocStore.getState().txBase) throw new Error('The user is dragging something right now. Try again in a moment.')
  const { doc: current, ephemeral, revision, savedRevision } = useDocStore.getState()
  if (current && !ephemeral) await storeDoc(current, revision !== savedRevision)
  await storeDoc(doc, dirty)
  // Loaded before navigating, so the editor route and the leave guard see it as already open.
  useDocStore.getState().load(doc, !dirty)
  useUi.getState().select([])
  await host.openEditor(doc.id)
  await host.refreshRecent()
  return summary(doc)
}

export async function bridgeOpen({ id }: { id: string }): Promise<DiagramSummary> {
  if (shownDoc()?.id === id && !useDocStore.getState().ephemeral) return summary(openDoc())
  const stored = await loadStoredDoc(id)
  if (!stored) throw new Error(`No diagram with id "${id}" in this browser. list_diagrams shows the ones there are.`)
  return show(stored.doc, stored.dirty)
}

export async function bridgeCreate({ name, doc: raw }: CreateParams): Promise<DiagramSummary> {
  const doc = raw === undefined ? emptyDoc(name || undefined) : parseDoc(raw)
  // Never overwrite a stored diagram that happens to have the same id.
  doc.id = newId('d')
  if (name) doc.name = name
  return show(doc, true)
}

/** Answer one request. Throws with a message for the AI when it can't. */
export async function handleBridgeRequest(req: BridgeRequest): Promise<unknown> {
  switch (req.method) {
    case 'status':
      return bridgeStatus()
    case 'get':
      return bridgeGet()
    case 'replace':
      return bridgeReplace(req.params)
    case 'list':
      return bridgeList()
    case 'open':
      return bridgeOpen(req.params)
    case 'create':
      return bridgeCreate(req.params)
    default:
      throw new Error(`Unknown request "${(req as { method?: string }).method}". Update Archipen or the MCP server.`)
  }
}
