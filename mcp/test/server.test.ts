import { readFileSync } from 'node:fs'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import { WebSocket } from 'ws'
import { bridgeUrl, CLOSE, type BridgeRequest } from '../../app/src/io/bridgeProtocol'
import { Bridge, createServer } from '../src/index'

const ORIGIN = 'http://localhost:5173'
const example = () => JSON.parse(readFileSync(new URL('../../examples/minimal.archipen.json', import.meta.url), 'utf8'))

/** Stands in for the editor tab: answers `get` and `replace` like app/src/commands/bridge.ts. */
class FakeTab {
  doc = example()
  revision = 1
  readOnly = false
  /** Other diagrams "stored in the browser", by id. */
  stored: Record<string, { name: string; pages: unknown[] }> = { other: { name: 'Other', pages: [{}] } }
  ws: WebSocket
  closed: Promise<number>
  constructor(url: string, origin = ORIGIN) {
    this.ws = new WebSocket(url, { origin })
    this.closed = new Promise((resolve) => this.ws.on('close', (code) => resolve(code)))
    this.ws.on('message', (data) => {
      const req = JSON.parse(String(data)) as BridgeRequest
      const reply = (body: object) => this.ws.send(JSON.stringify({ id: req.id, ...body }))
      const summary = (id: string, d: { name: string; pages: unknown[] }) => ({ id, name: d.name, pages: d.pages.length, open: id === this.doc.id })
      if (req.method === 'status')
        return reply({ result: { screen: 'editor', diagram: { id: this.doc.id, name: this.doc.name }, revision: this.revision, readOnly: this.readOnly } })
      if (req.method === 'get')
        return reply({ result: { doc: this.doc, revision: this.revision, pageId: this.doc.pages[0].id, selection: [], mode: 'edit', presenting: false, ephemeral: false } })
      if (req.method === 'list') return reply({ result: Object.entries(this.stored).map(([id, d]) => summary(id, d)) })
      if (req.method === 'open') {
        const d = this.stored[req.params.id]
        return d ? reply({ result: summary(req.params.id, d) }) : reply({ error: { message: `No diagram with id "${req.params.id}"` } })
      }
      if (req.method === 'create') {
        const d = (req.params.doc as { name: string; pages: unknown[] }) ?? { name: req.params.name ?? 'Untitled diagram', pages: [{}] }
        this.stored.created = { ...d, name: req.params.name ?? d.name }
        return reply({ result: summary('created', this.stored.created) })
      }
      if (req.method !== 'replace') return reply({ error: { message: 'unknown' } })
      if (this.readOnly) return reply({ error: { message: 'This diagram is read-only.' } })
      if (req.params.expectRevision !== this.revision) return reply({ error: { message: 'stale' } })
      this.doc = req.params.doc
      this.revision++
      reply({ result: { revision: this.revision } })
    })
  }
  opened = () => new Promise<void>((resolve, reject) => (this.ws.once('open', () => resolve()), this.ws.once('error', reject)))
}

let bridge: Bridge
let client: Client
let tabs: FakeTab[]

const call = async (name: string, args: Record<string, unknown> = {}) => (await client.callTool({ name, arguments: args })) as CallToolResult
const textOf = (r: CallToolResult) => r.content.map((c) => (c.type === 'text' ? c.text : `[${c.type}]`)).join('\n')
const connectTab = async (url = bridgeUrl(bridge.pairing), origin = ORIGIN) => {
  const tab = new FakeTab(url, origin)
  tabs.push(tab)
  await tab.opened()
  await new Promise((r) => setTimeout(r, 20))
  return tab
}

beforeEach(async () => {
  tabs = []
  bridge = new Bridge({ port: 0, origins: [ORIGIN] })
  await bridge.start()
  const server = createServer(bridge, { appUrl: 'http://localhost:5173/' })
  const [a, b] = InMemoryTransport.createLinkedPair()
  client = new Client({ name: 'test', version: '1' })
  await Promise.all([server.connect(a), client.connect(b)])
})

afterEach(async () => {
  for (const t of tabs) t.ws.close()
  await client.close()
  await bridge.close()
})

describe('without a tab', () => {
  test('tools explain how to pair', async () => {
    const r = await call('get_diagram')
    expect(r.isError).toBe(true)
    expect(textOf(r)).toContain(`http://localhost:5173/#/?mcp=${bridge.port}.${bridge.token}`)
    const status = textOf(await call('connection_status'))
    expect(status).toContain('No Archipen editor is connected')
    expect(status).toContain(`paste this pairing code: ${bridge.port}.${bridge.token}`)
  })

  test('validate_diagram works on a passed document', async () => {
    expect(textOf(await call('validate_diagram', { doc: example() }))).toBe('Valid, no warnings.')
    const r = await call('validate_diagram', { doc: { format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 4, y: 0 }] }] } })
    expect(textOf(r)).toContain('Duplicate id "a"')
  })

  test('the file format is a tool and a resource', async () => {
    expect(textOf(await call('get_file_format'))).toContain('# ')
    const res = await client.readResource({ uri: 'archipen://schema' })
    const schema = res.contents[0]
    expect('text' in schema && JSON.parse(schema.text)).toHaveProperty('properties.pages')
  })
})

describe('with a tab', () => {
  test('get_diagram returns the doc and revision', async () => {
    const tab = await connectTab()
    const out = JSON.parse(textOf(await call('get_diagram')))
    expect(out.revision).toBe(1)
    expect(out.doc.id).toBe(tab.doc.id)
    const page = JSON.parse(textOf(await call('get_diagram', { pageId: tab.doc.pages[0].id })))
    expect(page.pageIndex).toBe(0)
    expect((await call('get_diagram', { pageId: 'nope' })).isError).toBe(true)
  })

  test('patch_diagram applies a valid patch as one change', async () => {
    const tab = await connectTab()
    const node = { id: 'cache', name: 'Cache', x: 0, y: 4 }
    const r = await call('patch_diagram', { ops: [{ op: 'add', path: '/pages/0/nodes/-', value: node }], expectRevision: 1 })
    expect(r.isError).toBeFalsy()
    expect(textOf(r)).toContain('Revision 2')
    expect(tab.doc.pages[0].nodes.at(-1).id).toBe('cache')
  })

  test('an invalid result is not applied', async () => {
    const tab = await connectTab()
    const dup = { id: tab.doc.pages[0].nodes[0].id, x: 10, y: 0 }
    const r = await call('patch_diagram', { ops: [{ op: 'add', path: '/pages/0/nodes/-', value: dup }] })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toContain('Duplicate id')
    expect(tab.revision).toBe(1)
  })

  test('a broken patch names the operation', async () => {
    await connectTab()
    const r = await call('patch_diagram', { ops: [{ op: 'remove', path: '/pages/9' }] })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toContain('ops[0]')
  })

  test('a stale expectRevision is refused', async () => {
    const tab = await connectTab()
    tab.revision = 5
    const r = await call('patch_diagram', { ops: [{ op: 'replace', path: '/name', value: 'X' }], expectRevision: 1 })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toContain('changed since revision 1')
    expect(tab.doc.name).not.toBe('X')
  })

  test('the tab can refuse a change', async () => {
    const tab = await connectTab()
    tab.readOnly = true
    const r = await call('replace_diagram', { doc: example() })
    expect(r.isError).toBe(true)
    expect(textOf(r)).toContain('read-only')
  })

  test('render_preview returns a PNG', async () => {
    await connectTab()
    const r = await call('render_preview')
    expect(r.content[0]).toMatchObject({ type: 'image', mimeType: 'image/png' })
  })

  test('connection_status reports the diagram on screen and the pairing code', async () => {
    const tab = await connectTab()
    const s = JSON.parse(textOf(await call('connection_status')))
    expect(s).toMatchObject({ connected: true, screen: 'editor', diagram: { name: tab.doc.name }, pairingCode: `${bridge.port}.${bridge.token}` })
  })

  test('list, open and create diagrams', async () => {
    await connectTab()
    expect(JSON.parse(textOf(await call('list_diagrams')))).toEqual([{ id: 'other', name: 'Other', pages: 1, open: false }])
    expect(JSON.parse(textOf(await call('open_diagram', { id: 'other' })))).toMatchObject({ id: 'other' })
    expect((await call('open_diagram', { id: 'nope' })).isError).toBe(true)
    expect(textOf(await call('new_diagram', { name: 'Fresh' }))).toContain('"name":"Fresh"')
    expect(textOf(await call('new_diagram', { doc: example() }))).toContain('"name":"Minimal"')
  })

  test('new_diagram refuses an invalid document before it reaches the tab', async () => {
    const tab = await connectTab()
    const r = await call('new_diagram', { doc: { format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a' }] }] } })
    expect(r.isError).toBe(true)
    expect(tab.stored.created).toBeUndefined()
  })

  test('the newest tab wins', async () => {
    const first = await connectTab()
    await connectTab()
    expect(await first.closed).toBe(CLOSE.replaced)
    expect(bridge.connected).toBe(true)
  })
})

describe('pairing checks', () => {
  test('a wrong token is closed with 4001', async () => {
    const tab = new FakeTab(bridgeUrl({ port: bridge.port, token: 'wrong-token-123' }))
    tabs.push(tab)
    expect(await tab.closed).toBe(CLOSE.badToken)
    expect(bridge.connected).toBe(false)
  })

  test('another origin is closed with 4003', async () => {
    const tab = new FakeTab(bridgeUrl(bridge.pairing), 'https://evil.example')
    tabs.push(tab)
    expect(await tab.closed).toBe(CLOSE.badOrigin)
    expect(bridge.connected).toBe(false)
  })

  test('a port in use is reported, not thrown', async () => {
    const other = new Bridge({ port: bridge.port, origins: [ORIGIN] })
    await other.start()
    expect(other.listenError).toContain('in use')
    await other.close()
  })
})
