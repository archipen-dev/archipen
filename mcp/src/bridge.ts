// The WebSocket the editor tab connects to. Listens on 127.0.0.1 only, and accepts a tab only with the right token
// and an allowed Origin. One tab at a time: the newest one wins.
import { randomBytes, timingSafeEqual } from 'node:crypto'
import type { IncomingMessage } from 'node:http'
import type { AddressInfo } from 'node:net'
import { WebSocket, WebSocketServer } from 'ws'
import { CLOSE, type BridgeReply, type CreateParams, type DiagramSummary, type Pairing, type ReplaceParams, type TabState, type TabStatus } from '../../app/src/io/bridgeProtocol'

export interface BridgeOptions {
  /** 0 picks a free port. */
  port: number
  /** Origins allowed to connect, e.g. "http://localhost:5173". "*" allows any (the token is still required). */
  origins: string[]
  /** A fixed token; a random one otherwise. */
  token?: string
  /** How long to wait for the tab to answer. Default 10 s. */
  timeoutMs?: number
}

export class NoTabError extends Error {}

export class Bridge {
  readonly token: string
  port = 0
  /** Why the server isn't listening (e.g. the port is in use), or null. */
  listenError: string | null = null
  private wss: WebSocketServer | null = null
  private tab: WebSocket | null = null
  private nextId = 1
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void; timer: NodeJS.Timeout }>()

  constructor(private readonly opts: BridgeOptions) {
    this.token = opts.token ?? randomBytes(18).toString('base64url')
  }

  get pairing(): Pairing {
    return { port: this.port, token: this.token }
  }

  get connected() {
    return this.tab?.readyState === WebSocket.OPEN
  }

  /** Start listening. Never throws: a failure is kept in `listenError` and reported by the tools. */
  start(): Promise<void> {
    return new Promise((resolve) => {
      const wss = new WebSocketServer({ host: '127.0.0.1', port: this.opts.port, maxPayload: 64 * 1024 * 1024 })
      wss.once('listening', () => {
        this.port = (wss.address() as AddressInfo).port
        this.wss = wss
        resolve()
      })
      wss.once('error', (e: NodeJS.ErrnoException) => {
        this.listenError =
          e.code === 'EADDRINUSE'
            ? `Port ${this.opts.port} is in use, probably by another Archipen MCP server. Set ARCHIPEN_MCP_PORT to another port.`
            : `Could not listen on 127.0.0.1:${this.opts.port}: ${e.message}`
        resolve()
      })
      wss.on('connection', (ws, req) => this.accept(ws, req))
    })
  }

  /** What the tab shows; works on the start page too. */
  status(): Promise<TabStatus> {
    return this.request('status') as Promise<TabStatus>
  }

  /** The diagrams stored in the tab's browser. */
  list(): Promise<DiagramSummary[]> {
    return this.request('list') as Promise<DiagramSummary[]>
  }

  /** Show a stored diagram in the tab. */
  open(id: string): Promise<DiagramSummary> {
    return this.request('open', { id }) as Promise<DiagramSummary>
  }

  /** Create a diagram in the tab's browser and show it. */
  create(params: CreateParams): Promise<DiagramSummary> {
    return this.request('create', params) as Promise<DiagramSummary>
  }

  /** Ask the tab for its diagram and state. */
  get(): Promise<TabState> {
    return this.request('get') as Promise<TabState>
  }

  /** Replace the tab's diagram. Resolves with the tab's new revision. */
  replace(params: ReplaceParams): Promise<{ revision: number }> {
    return this.request('replace', params) as Promise<{ revision: number }>
  }

  close(): Promise<void> {
    for (const p of this.pending.values()) clearTimeout(p.timer)
    this.pending.clear()
    this.tab?.close()
    return new Promise((resolve) => (this.wss ? this.wss.close(() => resolve()) : resolve()))
  }

  private accept(ws: WebSocket, req: IncomingMessage) {
    const origin = req.headers.origin ?? ''
    if (!this.opts.origins.includes('*') && !this.opts.origins.includes(origin)) return ws.close(CLOSE.badOrigin, 'Origin not allowed')
    const token = new URL(req.url ?? '/', 'http://localhost').searchParams.get('token') ?? ''
    if (!sameToken(token, this.token)) return ws.close(CLOSE.badToken, 'Wrong token')

    this.tab?.close(CLOSE.replaced, 'Another tab connected')
    this.tab = ws
    ws.on('message', (data) => this.onReply(String(data)))
    ws.on('close', () => {
      if (this.tab !== ws) return
      this.tab = null
      this.failPending('The editor tab disconnected.')
    })
  }

  private request(method: string, params?: unknown): Promise<unknown> {
    const tab = this.tab
    if (!tab || tab.readyState !== WebSocket.OPEN) return Promise.reject(new NoTabError('No editor tab is connected.'))
    const id = this.nextId++
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id)
        reject(new Error('The editor tab did not answer in time.'))
      }, this.opts.timeoutMs ?? 10_000)
      this.pending.set(id, { resolve, reject, timer })
      tab.send(JSON.stringify(params === undefined ? { id, method } : { id, method, params }))
    })
  }

  private onReply(text: string) {
    let msg: BridgeReply
    try {
      msg = JSON.parse(text)
    } catch {
      return
    }
    const p = this.pending.get(msg?.id)
    if (!p) return
    this.pending.delete(msg.id)
    clearTimeout(p.timer)
    if ('error' in msg) p.reject(new Error(String(msg.error?.message ?? 'The editor refused the request.')))
    else p.resolve(msg.result)
  }

  private failPending(message: string) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer)
      p.reject(new Error(message))
    }
    this.pending.clear()
  }
}

function sameToken(a: string, b: string) {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
