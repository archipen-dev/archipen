import { beforeEach, describe, expect, it, vi } from 'vitest'
import minimal from '../../../examples/minimal.archipen.json'
import { parseDoc } from '../model/defaults'
import type { Doc } from '../model/schema'
import { useDocStore } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { bridgeGet, bridgeReplace, bridgeStatus, handleBridgeRequest, setBridgeHost, type BridgeHost } from './bridge'

// The browser's diagram storage (IndexedDB), in memory.
const stored = vi.hoisted(() => new Map<string, { doc: unknown; dirty: boolean; updatedAt: string }>())
vi.mock('../io/autosave', () => ({
  storeDoc: async (doc: { id: string }, dirty = false) => void stored.set(doc.id, { doc: structuredClone(doc), dirty, updatedAt: new Date().toISOString() }),
  loadStoredDoc: async (id: string) => {
    const s = stored.get(id)
    return s ? { doc: structuredClone(s.doc), dirty: s.dirty } : null
  },
  listStoredDocs: async () => [...stored.values()],
}))

let screen: ReturnType<BridgeHost['screen']>
const opened: string[] = []
setBridgeHost({
  screen: () => screen,
  openEditor: async (docId) => {
    opened.push(docId)
    screen = { kind: 'editor', docId }
  },
  refreshRecent: async () => {},
})

const withNode = (id: string) => {
  const raw = structuredClone(bridgeGet().doc) as unknown as { id: string; pages: { nodes: object[] }[] }
  raw.pages[0].nodes.push({ id, name: id, x: 0, y: 4 })
  return raw
}

beforeEach(() => {
  const doc = parseDoc(minimal)
  useDocStore.getState().load(doc)
  useUi.setState({ mode: 'edit', presenting: false, selection: ['app'] })
  screen = { kind: 'editor', docId: doc.id }
  stored.clear()
  opened.length = 0
})

describe('bridge requests', () => {
  it('get returns the doc, revision and selection', () => {
    const s = bridgeGet()
    expect(s.doc.pages[0].nodes.map((n) => n.id)).toEqual(['app', 'db'])
    expect(s.revision).toBe(useDocStore.getState().revision)
    expect(s.selection).toEqual(['app'])
    expect(s.pageId).toBe('main')
  })

  it('replace is one undo step and keeps the diagram id', () => {
    const { revision, doc } = bridgeGet()
    const docId = doc.id
    const out = bridgeReplace({ doc: { ...withNode('cache'), id: 'other' }, expectRevision: revision })
    expect(out.revision).toBe(revision + 1)
    expect(bridgeGet().doc.id).toBe(docId)
    expect(bridgeGet().doc.pages[0].nodes.at(-1)!.id).toBe('cache')
    useDocStore.getState().undo()
    expect(bridgeGet().doc.pages[0].nodes.map((n) => n.id)).toEqual(['app', 'db'])
  })

  it('drops selected ids that no longer exist', () => {
    const raw = withNode('cache')
    raw.pages[0].nodes = raw.pages[0].nodes.filter((n) => (n as { id: string }).id !== 'app')
    ;(raw as unknown as { pages: { edges: object[] }[] }).pages[0].edges = []
    bridgeReplace({ doc: raw })
    expect(useUi.getState().selection).toEqual([])
  })

  it('refuses a stale revision', () => {
    expect(() => bridgeReplace({ doc: withNode('x'), expectRevision: -1 })).toThrow(/changed in the editor/)
  })

  it('refuses an invalid document', () => {
    expect(() => bridgeReplace({ doc: { format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a' }] }] } })).toThrow(/Not a valid Archipen file/)
  })

  it('refuses share links, view mode, presenting and open gestures', () => {
    useDocStore.setState({ ephemeral: true })
    expect(() => bridgeReplace({ doc: withNode('x') })).toThrow(/share link/)
    useDocStore.setState({ ephemeral: false })
    useUi.setState({ presenting: true })
    expect(() => bridgeReplace({ doc: withNode('x') })).toThrow(/edit mode/)
    useUi.setState({ presenting: false, mode: 'view' })
    expect(() => bridgeReplace({ doc: withNode('x') })).toThrow(/edit mode/)
    useUi.setState({ mode: 'edit' })
    useDocStore.getState().begin()
    expect(() => bridgeReplace({ doc: withNode('x') })).toThrow(/dragging/)
    useDocStore.getState().cancel()
  })

  it('handles requests by method', async () => {
    await expect(handleBridgeRequest({ id: 1, method: 'get' })).resolves.toHaveProperty('revision')
    await expect(handleBridgeRequest({ id: 2, method: 'nope' } as never)).rejects.toThrow(/Unknown request/)
  })

  it('fails without an open diagram', () => {
    useDocStore.setState({ doc: null })
    expect(() => bridgeGet()).toThrow(/No diagram is open/)
  })

  it('on the start page the last diagram still in the store is not used', () => {
    screen = { kind: 'other' }
    expect(() => bridgeGet()).toThrow(/new_diagram/)
    expect(() => bridgeReplace({ doc: minimal })).toThrow(/No diagram is open/)
    expect(bridgeStatus()).toMatchObject({ screen: 'other', diagram: null, readOnly: true })
  })
})

describe('switching diagrams', () => {
  it('create makes a new diagram, keeps the old one saved, and shows the new one', async () => {
    const before = bridgeGet().doc.id
    screen = { kind: 'other' }
    const created = (await handleBridgeRequest({ id: 1, method: 'create', params: { name: 'Fresh' } })) as { id: string; name: string; open: boolean }
    expect(created).toMatchObject({ name: 'Fresh', open: true })
    expect(created.id).not.toBe(before)
    expect(opened).toEqual([created.id])
    expect(useDocStore.getState().doc!.name).toBe('Fresh')
    expect(stored.has(before)).toBe(true)
    expect(stored.get(created.id)!.dirty).toBe(true)
  })

  it('create from a document gives it a new id', async () => {
    const created = (await handleBridgeRequest({ id: 1, method: 'create', params: { doc: { ...minimal, id: 'taken' } } })) as { id: string; name: string }
    expect(created.id).not.toBe('taken')
    expect(created.name).toBe('Minimal')
    await expect(handleBridgeRequest({ id: 2, method: 'create', params: { doc: { format: 'nope' } } })).rejects.toThrow(/Not a valid/)
  })

  it('list and open stored diagrams', async () => {
    const other = { ...parseDoc(minimal), id: 'other', name: 'Other' } as Doc
    stored.set('other', { doc: other, dirty: false, updatedAt: '2026-01-01T00:00:00Z' })
    const list = (await handleBridgeRequest({ id: 1, method: 'list' })) as { id: string; open: boolean }[]
    expect(list).toEqual([expect.objectContaining({ id: 'other', name: 'Other', open: false })])
    await handleBridgeRequest({ id: 2, method: 'open', params: { id: 'other' } })
    expect(opened).toEqual(['other'])
    expect(bridgeGet().doc.name).toBe('Other')
    await expect(handleBridgeRequest({ id: 3, method: 'open', params: { id: 'missing' } })).rejects.toThrow(/list_diagrams/)
  })
})
