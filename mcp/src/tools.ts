// The MCP server: tools that read and change the diagram open in the connected editor tab, and the file format as
// resources. Changes are checked here first (JSON Patch, schema and the file rules), so a bad edit never reaches the tab.
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import jsonpatch, { type Operation } from 'fast-json-patch'
import { z } from 'zod'
import fileFormat from '../../docs/file-format.md?raw'
import jsonSchema from '../../schema/archipen.schema.json?raw'
import { formatPairing, pairingLink, type TabState } from '../../app/src/io/bridgeProtocol'
import { formatIssue, validateDoc, type Issue } from '../../app/src/model/parse'
import type { Bridge } from './bridge'

export interface ServerOptions {
  /** Where the app runs; the pairing link opens it. */
  appUrl: string
  version?: string
}

const INSTRUCTIONS = `Archipen is an isometric architecture diagram editor that runs in the browser. These tools read and edit the
diagram open in the user's editor tab; each change shows up at once and the user can undo it.
Before writing, read the file format (resource archipen://file-format, or the get_file_format tool): ids, coordinates, icons and layout rules.
Typical flow: connection_status → (new_diagram, or list_diagrams → open_diagram, if no diagram is on screen) → get_diagram →
patch_diagram with expectRevision → render_preview to check the layout.
If no tab is connected, give the user the pairing link from connection_status, or the pairing code to paste into the
robot button in the editor's top bar (this keeps the diagram they have open).`

const text = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }] })
const fail = (t: string): CallToolResult => ({ content: [{ type: 'text', text: t }], isError: true })
const issueLines = (issues: Issue[]) => issues.map((i) => `${i.level}: ${formatIssue(i)}`).join('\n')

const PatchOp = z.object({
  op: z.enum(['add', 'remove', 'replace', 'move', 'copy', 'test']),
  path: z.string().describe('JSON Pointer, e.g. "/pages/0/nodes/-" to append a node to the first page.'),
  value: z.unknown().optional(),
  from: z.string().optional().describe('For move and copy.'),
})

const expectRevision = z
  .number()
  .int()
  .optional()
  .describe('The revision from get_diagram. The change is refused if the diagram changed since (for example, the user edited it).')

export function createServer(bridge: Bridge, opts: ServerOptions) {
  const server = new McpServer({ name: 'archipen', version: opts.version ?? '0.1.0' }, { instructions: INSTRUCTIONS })

  const link = () => pairingLink(opts.appUrl, bridge.pairing)
  const notConnected = () =>
    bridge.listenError
      ? `The Archipen bridge is not running: ${bridge.listenError}`
      : `No Archipen editor is connected. Ask the user to open this link in Chrome or Firefox: ${link()}\nOr, to keep the diagram they have open, to click the robot button in the editor's top bar and paste this pairing code: ${formatPairing(bridge.pairing)}`

  /** Run `fn` with the tab's state, turning a missing tab or a refusal into a tool error. */
  const withTab = (fn: (state: TabState) => Promise<CallToolResult>) => onTab(async () => fn(await bridge.get()))

  /** Run `fn` against the connected tab, turning a missing tab or a refusal into a tool error. */
  const onTab = async (fn: () => Promise<CallToolResult>): Promise<CallToolResult> => {
    if (!bridge.connected) return fail(notConnected())
    try {
      return await fn()
    } catch (e) {
      return fail(e instanceof Error ? e.message : String(e))
    }
  }

  /** Validate `raw` and send it to the tab as one undoable change. */
  const write = async (state: TabState, raw: unknown, expected: number | undefined) => {
    if (expected !== undefined && expected !== state.revision)
      return fail(`The diagram changed since revision ${expected} (now ${state.revision}). Call get_diagram again and redo the change.`)
    const { doc, issues } = validateDoc(raw)
    if (!doc) return fail(`Not applied: the diagram would be invalid.\n${issueLines(issues)}`)
    const { revision } = await bridge.replace({ doc: raw, expectRevision: state.revision })
    const warnings = issues.filter((i) => i.level === 'warning')
    return text(`Applied. Revision ${revision}.${warnings.length ? `\nWarnings:\n${issueLines(warnings)}` : ''}`)
  }

  server.registerTool(
    'connection_status',
    {
      title: 'Connection status',
      description: 'Whether an Archipen editor tab is connected, which diagram it has open, and the link that pairs a tab.',
      annotations: { readOnlyHint: true },
    },
    async () => {
      if (!bridge.connected) return text(notConnected())
      try {
        const s = await bridge.status()
        const hint = s.diagram ? undefined : 'No diagram is on screen. Use new_diagram, or list_diagrams and open_diagram.'
        return text(JSON.stringify({ connected: true, ...s, hint, pairingLink: link(), pairingCode: formatPairing(bridge.pairing) }))
      } catch (e) {
        return text(`A tab is connected but did not answer: ${e instanceof Error ? e.message : e}`)
      }
    },
  )

  server.registerTool(
    'list_diagrams',
    {
      title: 'List diagrams',
      description: 'The diagrams saved in the connected browser (id, name, page count, last change), newest first. `open` marks the one on screen.',
      annotations: { readOnlyHint: true },
    },
    () => onTab(async () => text(JSON.stringify(await bridge.list()))),
  )

  server.registerTool(
    'open_diagram',
    {
      title: 'Open diagram',
      description: 'Show a diagram saved in the browser (an id from list_diagrams) in the editor tab. The diagram on screen stays saved in the browser.',
      inputSchema: { id: z.string().describe('Diagram id from list_diagrams.') },
    },
    ({ id }) => onTab(async () => text(JSON.stringify(await bridge.open(id)))),
  )

  server.registerTool(
    'new_diagram',
    {
      title: 'New diagram',
      description:
        'Create a diagram in the browser and show it in the editor tab, empty or from a full Archipen document. It gets a new id; the diagram on screen stays saved. Then edit it with patch_diagram.',
      inputSchema: {
        name: z.string().optional().describe('The diagram name.'),
        doc: z.record(z.string(), z.unknown()).optional().describe('A complete Archipen document to start from.'),
      },
    },
    ({ name, doc }) =>
      onTab(async () => {
        if (doc) {
          const { doc: ok, issues } = validateDoc(doc)
          if (!ok) return fail(`Not created: the diagram would be invalid.\n${issueLines(issues)}`)
        }
        const created = await bridge.create({ name, doc })
        return text(`Created and opened. ${JSON.stringify(created)}`)
      }),
  )

  server.registerTool(
    'get_diagram',
    {
      title: 'Get diagram',
      description:
        'The diagram open in the editor as Archipen JSON, with its revision, the page on screen and the selected item ids. Pass pageId to get only that page.',
      inputSchema: { pageId: z.string().optional().describe('Only this page (its id). Default: the whole diagram.') },
      annotations: { readOnlyHint: true },
    },
    ({ pageId }) =>
      withTab(async (s) => {
        const meta = { revision: s.revision, pageId: s.pageId, selection: s.selection, readOnly: s.ephemeral || s.mode !== 'edit' || s.presenting }
        if (!pageId) return text(JSON.stringify({ ...meta, doc: s.doc }))
        const index = s.doc.pages.findIndex((p) => p.id === pageId)
        if (index < 0) return fail(`No page "${pageId}". Pages: ${s.doc.pages.map((p) => p.id).join(', ')}`)
        return text(JSON.stringify({ ...meta, pageIndex: index, page: s.doc.pages[index] }))
      }),
  )

  server.registerTool(
    'patch_diagram',
    {
      title: 'Patch diagram',
      description:
        'Change the open diagram with JSON Patch (RFC 6902) operations on the document from get_diagram. All operations apply as one change the user can undo; if the result is invalid nothing is applied and the errors are listed.',
      inputSchema: { ops: z.array(PatchOp).min(1), expectRevision },
      annotations: { destructiveHint: false },
    },
    ({ ops, expectRevision: expected }) =>
      withTab(async (s) => {
        let next: unknown
        try {
          next = jsonpatch.applyPatch(structuredClone(s.doc), ops as Operation[], true, true).newDocument
        } catch (e) {
          const err = e as { index?: number; message?: string }
          return fail(`Patch failed${err.index !== undefined ? ` at ops[${err.index}]` : ''}: ${err.message ?? e}`)
        }
        return write(s, next, expected)
      }),
  )

  server.registerTool(
    'replace_diagram',
    {
      title: 'Replace diagram',
      description:
        'Replace the whole open diagram with a new Archipen document, as one change the user can undo. The tab keeps its diagram id. Prefer patch_diagram for small changes.',
      inputSchema: { doc: z.record(z.string(), z.unknown()).describe('A complete Archipen document.'), expectRevision },
    },
    ({ doc, expectRevision: expected }) => withTab((s) => write(s, doc, expected)),
  )

  server.registerTool(
    'validate_diagram',
    {
      title: 'Validate diagram',
      description: 'Check an Archipen document (or, without one, the open diagram) and list its errors and warnings.',
      inputSchema: { doc: z.record(z.string(), z.unknown()).optional() },
      annotations: { readOnlyHint: true },
    },
    async ({ doc }) => {
      const check = (raw: unknown) => {
        const { issues } = validateDoc(raw)
        return text(issues.length ? issueLines(issues) : 'Valid, no warnings.')
      }
      return doc ? check(doc) : withTab(async (s) => check(s.doc))
    },
  )

  server.registerTool(
    'render_preview',
    {
      title: 'Render preview',
      description: 'A PNG of one page of the open diagram, drawn like the app’s export, to check the layout.',
      inputSchema: {
        pageId: z.string().optional().describe('Default: the page on screen.'),
        theme: z.enum(['light', 'dark']).optional(),
        projection: z.enum(['iso', '2d']).optional(),
      },
      annotations: { readOnlyHint: true },
    },
    ({ pageId, theme, projection }) =>
      withTab(async (s) => {
        const { renderPng } = await import('@archipen/render')
        const png = await renderPng(s.doc, { page: pageId ?? s.pageId, theme, projection, scale: 1 })
        return { content: [{ type: 'image', data: png.toString('base64'), mimeType: 'image/png' }] }
      }),
  )

  server.registerTool(
    'get_file_format',
    {
      title: 'File format',
      description: 'The Archipen file format guide: fields, coordinates, layout tips and the icon names. Read it before the first edit.',
      annotations: { readOnlyHint: true },
    },
    async () => text(fileFormat),
  )

  server.registerResource('file-format', 'archipen://file-format', { title: 'Archipen file format', mimeType: 'text/markdown' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'text/markdown', text: fileFormat }],
  }))
  server.registerResource('schema', 'archipen://schema', { title: 'Archipen JSON Schema', mimeType: 'application/schema+json' }, async (uri) => ({
    contents: [{ uri: uri.href, mimeType: 'application/schema+json', text: jsonSchema }],
  }))

  return server
}
