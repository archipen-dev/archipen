// The editor's side of the link to a local AI tool: a WebSocket to the Archipen MCP server on 127.0.0.1.
// Pairing comes from a link (`#/?mcp=<port>.<token>`, see pairingFromUrl.ts) and lasts for this tab.
import { bridgeStatus, handleBridgeRequest } from '../commands/bridge'
import { type BridgeStatus, useBridge } from '../store/bridgeStore'
import { toast } from '../store/toastStore'
import { bridgeUrl, CLOSE, formatPairing, parsePairing, type BridgeRequest, type Pairing } from './bridgeProtocol'

const STORAGE_KEY = 'archipen:mcp'
const MAX_RETRY_MS = 30_000

export type Failure = Exclude<BridgeStatus, 'off' | 'connecting' | 'connected'>

export type FailureEvent =
  | { kind: 'missing' }
  | { kind: 'throw'; error: unknown }
  | { kind: 'close'; code: number; opened: boolean; secure: boolean; userAgent: string }

/**
 * Chrome and Firefox treat 127.0.0.1 as secure, so an https page may open ws://127.0.0.1. WebKit (Safari, and every
 * browser on iOS) has blocked it as mixed content in some versions, and a blocked socket looks just like a server that
 * isn't running. So for WebKit on https an early failure is reported as "probably blocked", and retried anyway.
 */
export function allowsLoopbackFromHttps(userAgent: string) {
  if (/iPhone|iPad|iPod|CriOS|FxiOS|EdgiOS/.test(userAgent)) return false
  return /Chrome\/|Chromium\/|Firefox\//.test(userAgent)
}

/** What a failed or closed connection means. */
export function classifyFailure(e: FailureEvent): Failure {
  if (e.kind === 'missing' || e.kind === 'throw') return 'unsupported'
  if (e.code === CLOSE.replaced) return 'replaced'
  if (e.code === CLOSE.badToken || e.code === CLOSE.badOrigin) return 'rejected'
  if (!e.opened && e.secure && !allowsLoopbackFromHttps(e.userAgent)) return 'unsupported'
  return 'unreachable'
}

/** `guessed`: "unsupported" inferred from the browser, not reported by it. */
export function failureMessage(status: Failure, port: number, code?: number, guessed = false) {
  switch (status) {
    case 'unsupported':
      return guessed
        ? `Can't connect to the AI. This browser may block connections from https pages to local AI tools: use Chrome or Firefox, or run Archipen locally (http://localhost). Or the Archipen MCP server isn't running on port ${port}.`
        : 'This browser blocks connections from this page to local AI tools. Use Chrome or Firefox, or run Archipen locally (http://localhost).'
    case 'unreachable':
      return `Can't reach the Archipen MCP server on port ${port}. Is it running? If the browser asks about local network access, allow it.`
    case 'rejected':
      return code === CLOSE.badOrigin
        ? `The Archipen MCP server doesn't allow this site (${location.origin}). Add it to ARCHIPEN_MCP_ORIGINS.`
        : 'The Archipen MCP server refused this pairing link; it has probably restarted. Ask the AI for a new link.'
    case 'replaced':
      return 'Another tab took over the AI connection.'
  }
}

/* ── Pairing storage ──────────────────────────────────────────────────────── */

export function savePairing(p: Pairing | null) {
  try {
    if (p) sessionStorage.setItem(STORAGE_KEY, formatPairing(p))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* storage blocked: the pairing lasts until reload */
  }
}

function loadPairing(): Pairing | null {
  try {
    return parsePairing(sessionStorage.getItem(STORAGE_KEY))
  } catch {
    return null
  }
}

/* ── Connection ───────────────────────────────────────────────────────────── */

let pairing: Pairing | null = null
let socket: WebSocket | null = null
let retryTimer: ReturnType<typeof setTimeout> | undefined
let attempt = 0

function setStatus(status: BridgeStatus, message = '') {
  const prev = useBridge.getState()
  useBridge.setState({ status, message, port: pairing?.port ?? null })
  if (status === prev.status) return
  if (status === 'connected')
    toast(bridgeStatus().diagram ? 'Connected to the AI. Its changes can be undone like yours.' : 'Connected to the AI. Ask it to create a diagram or open one of yours.')
  else if (message) toast(message, 'error')
}

/** Connect with the given pairing, or the one saved for this tab. Does nothing without one. */
export function startBridge(p: Pairing | null = loadPairing()) {
  stop()
  pairing = p
  if (!pairing) return
  savePairing(pairing)
  attempt = 0
  connect()
}

/**
 * Pair with a code the AI gave: `<port>.<token>`, or a whole pairing link. Returns false when it isn't one.
 */
export function pairWithCode(text: string): boolean {
  const value = text.trim()
  const fromLink = /[?&]mcp=([^&#\s]+)/.exec(value)?.[1]
  const pairing = parsePairing(fromLink ? decodeURIComponent(fromLink) : value)
  if (!pairing) return false
  startBridge(pairing)
  return true
}

/** Forget the pairing and close the connection. */
export function disconnectBridge() {
  stop()
  pairing = null
  savePairing(null)
  useBridge.setState({ status: 'off', message: '', port: null })
}

/** Try again now (after "unreachable"). */
export function retryBridge() {
  if (!pairing) return
  clearTimeout(retryTimer)
  attempt = 0
  connect()
}

function stop() {
  clearTimeout(retryTimer)
  const s = socket
  socket = null
  s?.close()
}

function fail(e: FailureEvent) {
  const status = classifyFailure(e)
  const guessed = status === 'unsupported' && e.kind === 'close'
  setStatus(status, failureMessage(status, pairing!.port, e.kind === 'close' ? e.code : undefined, guessed))
  if (status !== 'unreachable' && !guessed) return
  const delay = Math.min(MAX_RETRY_MS, 1000 * 2 ** attempt++)
  retryTimer = setTimeout(connect, delay)
}

function connect() {
  if (!pairing) return
  const s = useBridge.getState().status
  if (s !== 'unreachable' && s !== 'unsupported') setStatus('connecting')
  if (typeof WebSocket === 'undefined') return fail({ kind: 'missing' })
  let ws: WebSocket
  try {
    ws = new WebSocket(bridgeUrl(pairing))
  } catch (error) {
    return fail({ kind: 'throw', error })
  }
  socket = ws
  let opened = false
  ws.addEventListener('open', () => {
    if (socket !== ws) return
    opened = true
    attempt = 0
    setStatus('connected')
  })
  ws.addEventListener('message', (ev) => {
    if (socket !== ws) return
    let req: BridgeRequest
    try {
      req = JSON.parse(String(ev.data))
    } catch {
      return
    }
    void handleBridgeRequest(req).then(
      (result) => ws.send(JSON.stringify({ id: req.id, result })),
      (err) => ws.send(JSON.stringify({ id: req.id, error: { message: err instanceof Error ? err.message : String(err) } })),
    )
  })
  ws.addEventListener('close', (ev) => {
    if (socket !== ws) return
    socket = null
    fail({ kind: 'close', code: ev.code, opened, secure: location.protocol === 'https:', userAgent: navigator.userAgent })
  })
}
