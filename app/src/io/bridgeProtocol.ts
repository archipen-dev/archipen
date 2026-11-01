/*
 * The messages between the editor tab and the local MCP server (`mcp/`). Shared by both sides: the MCP server
 * bundles this file. The server sends requests, the tab answers them.
 *
 *   server → tab   { id, method: 'status' }                           → { id, result: TabStatus }
 *   server → tab   { id, method: 'get' }                              → { id, result: TabState }
 *   server → tab   { id, method: 'replace', params: ReplaceParams }   → { id, result: { revision } }
 *   server → tab   { id, method: 'list' }                             → { id, result: DiagramSummary[] }
 *   server → tab   { id, method: 'open', params: { id } }             → { id, result: DiagramSummary }
 *   server → tab   { id, method: 'create', params: CreateParams }     → { id, result: DiagramSummary }
 *   tab → server   { id, error: { message } }                         when a request fails
 *
 * The tab connects to ws://127.0.0.1:<port>/?token=<token>. The server checks the token and the Origin header
 * and closes the socket with one of CLOSE codes when it refuses the tab.
 */
import type { Doc } from '../model/schema'

export const DEFAULT_BRIDGE_PORT = 7331

/** Close codes the server sends; the tab shows a message for each. */
export const CLOSE = {
  /** Another tab connected; the newest one wins. */
  replaced: 4000,
  badToken: 4001,
  badOrigin: 4003,
} as const

export interface TabState {
  doc: Doc
  /** Counts every change in the tab, the user's included. Pass it back as `expectRevision` to detect edits in between. */
  revision: number
  /** The page on screen. */
  pageId: string
  /** Ids of the selected items. */
  selection: string[]
  /** "edit", or "view" for a read-only shared diagram. */
  mode: 'edit' | 'view'
  presenting: boolean
  /** Opened from a share link: read-only for the AI too. */
  ephemeral: boolean
}

/** What the tab shows: a diagram in the editor, a share link (read-only), or another screen such as the start page. */
export interface TabStatus {
  screen: 'editor' | 'share' | 'other'
  /** The diagram on screen, or null. */
  diagram: { id: string; name: string } | null
  revision: number
  readOnly: boolean
}

/** A diagram stored in the browser. */
export interface DiagramSummary {
  id: string
  name: string
  pages: number
  /** ISO time of the last change. */
  updatedAt?: string
  /** It is the one on screen. */
  open: boolean
}

export interface CreateParams {
  name?: string
  /** A full Archipen document to start from; an empty diagram without it. It gets a new id. */
  doc?: unknown
}

export interface ReplaceParams {
  /** The new document. The tab validates it again and keeps its own `id`. */
  doc: unknown
  /** Refuse the change when the tab's revision is no longer this one. */
  expectRevision?: number
}

export type BridgeRequest =
  | { id: number; method: 'status' | 'get' | 'list' }
  | { id: number; method: 'replace'; params: ReplaceParams }
  | { id: number; method: 'open'; params: { id: string } }
  | { id: number; method: 'create'; params: CreateParams }
export type BridgeReply = { id: number; result: unknown } | { id: number; error: { message: string } }

/** The pairing value in a link: `<port>.<token>`. */
export interface Pairing {
  port: number
  token: string
}

export const formatPairing = (p: Pairing) => `${p.port}.${p.token}`

export function parsePairing(value: string | null | undefined): Pairing | null {
  const m = /^(\d{1,5})\.([A-Za-z0-9_-]{8,128})$/.exec(value ?? '')
  if (!m) return null
  const port = Number(m[1])
  return port > 0 && port < 65536 ? { port, token: m[2] } : null
}

/** The link that opens the app and pairs it: `<appUrl>#/?mcp=<port>.<token>`. */
export function pairingLink(appUrl: string, p: Pairing) {
  const base = appUrl.split('#')[0]
  return `${base}#/?mcp=${formatPairing(p)}`
}

export const bridgeUrl = (p: Pairing) => `ws://127.0.0.1:${p.port}/?token=${encodeURIComponent(p.token)}`
