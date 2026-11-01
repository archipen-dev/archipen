// HTTP export server: POST a diagram, get SVG/PNG/PDF back. Plain node:http, no framework.
// Routes live under BASE_PATH, like the app container (deploy/Caddyfile):
//   POST {base}/export?format=png   diagram JSON in the body → the rendered file
//   GET  {base}/healthz             → "ok"
//   GET  {base}/                    → short usage text
//   {base} without the slash        → 308 to {base}/
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { availableParallelism } from 'node:os'
import { pathToFileURL } from 'node:url'
import { CONTENT_TYPES, fileBaseName, FORMATS, MAX_SCALE, type Format, type RenderOptions } from './index'
import { RenderFailure, RenderPool } from './pool'

export interface ServerOptions {
  /** Port to listen on; 0 picks a free one. Default 8080. */
  port?: number
  /** Interface to bind. Default all interfaces. */
  host?: string
  /** URL path to serve under, e.g. "/tools/archipen-api". Leading slash, no trailing slash; empty = root. */
  basePath?: string
  /** Largest accepted request body in bytes. Default 5 MB. */
  maxBodyBytes?: number
  /** Value for Access-Control-Allow-Origin (e.g. "https://example.com" or "*"). Default: no CORS headers. */
  corsOrigin?: string
  /** Render threads. Default: the number of CPUs. */
  workers?: number
  /** Renders that may wait for a free thread; more are refused with 503. Default 8 per thread. */
  maxQueue?: number
  /** Time limit for one render in ms; slower ones are stopped and answered with 422. Default 20 000. */
  renderTimeoutMs?: number
  /** Most nodes + zones + edges + texts in one diagram, all pages together; more are answered with 422. Default 1000. */
  maxItems?: number
  /** The built worker script. Default: dist/worker.mjs. */
  workerUrl?: URL
}

/** Server settings from the environment, as documented in docs/hosting.md. Unset ones keep their defaults. */
export function envOptions(env: NodeJS.ProcessEnv = process.env): ServerOptions {
  const int = (name: string, min: number): number | undefined => {
    const v = env[name]
    if (v === undefined || v === '') return undefined
    const n = Number(v)
    if (!Number.isInteger(n) || n < min) throw new Error(`${name} must be a whole number of at least ${min} (got "${v}")`)
    return n
  }
  return {
    corsOrigin: env.CORS_ORIGIN || undefined,
    workers: int('RENDER_WORKERS', 1),
    maxQueue: int('RENDER_QUEUE', 0),
    renderTimeoutMs: int('RENDER_TIMEOUT_MS', 100),
    maxItems: int('MAX_ITEMS', 1),
  }
}

const MB = 1024 * 1024

class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message)
  }
}

/** "/tools/api/" → "/tools/api", "" or "/" → "". Throws on a path without a leading slash. */
export function normalizeBasePath(p: string | undefined): string {
  const s = (p ?? '').trim().replace(/\/+$/, '')
  if (s && !s.startsWith('/')) throw new Error(`BASE_PATH must start with "/" (got "${p}")`)
  return s
}

function usage(base: string) {
  return `Archipen export server

POST ${base}/export?format=svg|png|pdf   body: diagram JSON (.archipen.json)
  theme=light|dark  projection=iso|2d  page=<id> (default: all pages; PNG: the first)  scale=2 (PNG, max ${MAX_SCALE})  padding=32
  transparent=1  animate=1 (SVG)  font=0 (SVG without embedded font)
GET  ${base}/healthz

Example:
  curl -X POST --data-binary @diagram.archipen.json '<host>${base}/export?format=png' -o diagram.png
`
}

const flag = (v: string | null) => v !== null && v !== '0' && v !== 'false' && v !== 'no'

function numberParam(q: URLSearchParams, name: string, min: number, max: number): number | undefined {
  const v = q.get(name)
  if (v === null || v === '') return undefined
  const n = Number(v)
  if (!Number.isFinite(n) || n < min || n > max) throw new HttpError(400, `${name} must be a number from ${min} to ${max}`)
  return n
}

function parseQuery(q: URLSearchParams): { format: Format; opts: RenderOptions } {
  const format = (q.get('format') ?? 'svg').toLowerCase() as Format
  if (!FORMATS.includes(format)) throw new HttpError(400, 'format must be svg, png or pdf')
  const theme = q.get('theme') ?? undefined
  if (theme && theme !== 'light' && theme !== 'dark') throw new HttpError(400, 'theme must be light or dark')
  const projection = q.get('projection') ?? undefined
  if (projection && projection !== 'iso' && projection !== '2d') throw new HttpError(400, 'projection must be iso or 2d')
  return {
    format,
    opts: {
      theme: theme as RenderOptions['theme'],
      projection: projection as RenderOptions['projection'],
      page: q.get('page') || undefined,
      scale: numberParam(q, 'scale', 0.1, MAX_SCALE),
      padding: numberParam(q, 'padding', 0, 1000),
      background: !flag(q.get('transparent')),
      animate: flag(q.get('animate')),
      embedFont: q.get('font') === null || flag(q.get('font')),
    },
  }
}

async function readBody(req: IncomingMessage, limit: number): Promise<Buffer> {
  const declared = Number(req.headers['content-length'])
  if (declared > limit) throw new HttpError(413, `Request body is larger than ${Math.round(limit / MB)} MB`)
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req as AsyncIterable<Buffer>) {
    size += chunk.length
    if (size > limit) throw new HttpError(413, `Request body is larger than ${Math.round(limit / MB)} MB`)
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/** "Web shop" → `inline; filename="Web shop.png"; filename*=UTF-8''Web%20shop.png` (ASCII fallback for old clients). */
function disposition(name: string) {
  const ascii = name.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_')
  return `inline; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(name)}`
}

/** Nodes, zones, edges and texts on all pages of a parsed (not yet validated) diagram. */
function itemCount(raw: unknown): number {
  const pages = raw && typeof raw === 'object' ? (raw as { pages?: unknown }).pages : undefined
  if (!Array.isArray(pages)) return 0
  const count = (p: unknown) =>
    p && typeof p === 'object' ? ['nodes', 'zones', 'edges', 'texts'].reduce((n, k) => n + (Array.isArray((p as Record<string, unknown>)[k]) ? ((p as Record<string, unknown[]>)[k]).length : 0), 0) : 0
  return pages.reduce((n: number, p) => n + count(p), 0)
}

export type Handler = ((req: IncomingMessage, res: ServerResponse) => Promise<unknown>) & {
  /** Stop the render threads. */
  close: () => Promise<void>
}

/** The request handler on its own, e.g. to mount it in an existing server. Call `close()` when done. */
export function createHandler(options: ServerOptions = {}): Handler {
  const base = normalizeBasePath(options.basePath)
  const limit = options.maxBodyBytes ?? 5 * MB
  const cors = options.corsOrigin
  const maxItems = options.maxItems ?? 1000
  const workers = options.workers ?? availableParallelism()
  const pool = new RenderPool({
    workers,
    maxQueue: options.maxQueue ?? workers * 8,
    timeoutMs: options.renderTimeoutMs ?? 20_000,
    workerUrl: options.workerUrl,
  })

  const send = (res: ServerResponse, status: number, body: string | Buffer, type: string, headers: Record<string, string> = {}) => {
    res.writeHead(status, { 'Content-Type': type, 'Content-Length': Buffer.byteLength(body), ...headers })
    res.end(body)
  }
  const sendJson = (res: ServerResponse, status: number, data: unknown, headers: Record<string, string> = {}) =>
    send(res, status, JSON.stringify(data), 'application/json; charset=utf-8', headers)

  const handler = async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader('Referrer-Policy', 'no-referrer')
    if (cors) {
      res.setHeader('Access-Control-Allow-Origin', cors)
      res.setHeader('Vary', 'Origin')
    }
    const url = new URL(req.url ?? '/', 'http://localhost')
    const path = url.pathname
    const method = req.method ?? 'GET'

    try {
      if (base && path === base) {
        res.writeHead(308, { Location: `${base}/${url.search}` })
        return res.end()
      }
      if (path === `${base}/` && (method === 'GET' || method === 'HEAD')) return send(res, 200, usage(base), 'text/plain; charset=utf-8')
      if (path === `${base}/healthz` && (method === 'GET' || method === 'HEAD')) return send(res, 200, 'ok\n', 'text/plain; charset=utf-8', { 'Cache-Control': 'no-store' })
      if (path === `${base}/export`) {
        if (method === 'OPTIONS' && cors) {
          res.writeHead(204, { 'Access-Control-Allow-Methods': 'POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400' })
          return res.end()
        }
        if (method !== 'POST') throw new HttpError(405, 'Use POST with the diagram JSON as the body', { allow: 'POST' })
        const { format, opts } = parseQuery(url.searchParams)
        const body = await readBody(req, limit)
        let raw: unknown
        try {
          raw = JSON.parse(body.toString('utf8'))
        } catch (e) {
          throw new HttpError(400, `Body is not valid JSON: ${(e as Error).message}`)
        }
        const items = itemCount(raw)
        if (items > maxItems) throw new HttpError(422, `The diagram has ${items} items; this server renders at most ${maxItems}`)
        const bytes = await pool.render(raw, format, opts)
        const title = typeof (raw as { name?: unknown }).name === 'string' ? (raw as { name: string }).name : ''
        const headers: Record<string, string> = { 'Content-Disposition': disposition(`${fileBaseName(title)}.${format}`), 'Cache-Control': 'no-store' }
        // An SVG opened straight from this URL must not run anything it contains.
        if (format === 'svg') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; font-src data:; img-src data:; sandbox"
        return send(res, 200, bytes, CONTENT_TYPES[format], headers)
      }
      throw new HttpError(404, 'Not found')
    } catch (e) {
      if (e instanceof HttpError) {
        const headers: Record<string, string> = e.status === 405 ? { Allow: String(e.extra.allow) } : {}
        if (e.status === 413) headers.Connection = 'close'
        return sendJson(res, e.status, { error: e.message }, headers)
      }
      if (e instanceof RenderFailure) {
        if (e.kind === 'diagram') return sendJson(res, 400, { error: e.message, issues: e.issues })
        if (e.kind === 'limit' || e.kind === 'timeout') return sendJson(res, 422, { error: e.message })
        if (e.kind === 'busy') return sendJson(res, 503, { error: e.message }, { 'Retry-After': '5' })
      }
      console.error(e)
      return sendJson(res, 500, { error: 'Rendering failed' })
    }
  }
  return Object.assign(handler, { close: () => pool.close() })
}

/** Start the export server. Resolves once it is listening. */
export async function startServer(options: ServerOptions = {}): Promise<{ server: Server; url: string; close: () => Promise<void> }> {
  const base = normalizeBasePath(options.basePath)
  const handler = createHandler({ ...envOptions(), ...withoutUndefined(options), basePath: base })
  const server = createServer((req, res) => void handler(req, res))
  // Slow or stuck clients are dropped; a render itself runs to completion once the body has arrived.
  server.requestTimeout = 30_000
  server.headersTimeout = 10_000
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.port ?? 8080, options.host, resolve)
  })
  const { port } = server.address() as AddressInfo
  return {
    server,
    url: `http://localhost:${port}${base}/`,
    close: async () => {
      await new Promise<void>((resolve, reject) => server.close((err) => (err ? reject(err) : resolve())))
      await handler.close()
    },
  }
}

const withoutUndefined = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>

/** Start the server and stop it cleanly on SIGTERM/SIGINT (needed as PID 1 in a container). Logs where it listens. */
export async function serve(options: ServerOptions): Promise<void> {
  const { url, close } = await startServer(options)
  console.error(`Archipen export server listening on ${url}`)
  const stop = () => {
    close().finally(() => process.exit(0))
    setTimeout(() => process.exit(0), 5000).unref()
  }
  process.once('SIGTERM', stop)
  process.once('SIGINT', stop)
}

// `node dist/server.mjs` starts it directly, configured from the environment.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  serve({ port: Number(process.env.PORT || 8080), basePath: process.env.BASE_PATH }).catch((e) => {
    console.error(`archipen: ${(e as Error).message}`)
    process.exit(1)
  })
}
