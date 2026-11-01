import { parseDoc } from '../model/defaults'
import type { Doc } from '../model/schema'

/**
 * Read-only share links: the whole diagram, deflated and base64url-encoded,
 * lives in the URL's #fragment. Fragments are never sent to a server, so the
 * diagram stays private to whoever has the link.
 */

const VERSION = '1'
/** Above this many characters some chat apps and browsers start truncating links. */
export const LONG_LINK = 60_000

/** Largest diagram a link may unpack to. A few KB of deflate can expand to gigabytes and take down the tab. */
export const MAX_SHARED_BYTES = 20 * 1024 * 1024

/** Run bytes through a (de)compression stream, giving up once the output passes `limit` bytes. */
async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream, limit = Infinity): Promise<Uint8Array> {
  const reader = new Blob([bytes as BlobPart]).stream().pipeThrough(stream).getReader()
  const chunks: Uint8Array[] = []
  let size = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error('too large')
    }
    chunks.push(value)
  }
  const out = new Uint8Array(size)
  let at = 0
  for (const c of chunks) {
    out.set(c, at)
    at += c.length
  }
  return out
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

/** `1.<deflated base64url JSON>` */
export async function encodeDoc(doc: Doc): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(doc))
  return `${VERSION}.${toBase64Url(await pipe(json, new CompressionStream('deflate-raw')))}`
}

export async function decodeDoc(payload: string): Promise<Doc> {
  const [version, data] = payload.replace(/^#/, '').split('.', 2)
  if (version !== VERSION || !data) throw new Error('This share link is not valid.')
  let json: string
  try {
    json = new TextDecoder().decode(await pipe(fromBase64Url(data), new DecompressionStream('deflate-raw'), MAX_SHARED_BYTES))
  } catch (e) {
    if ((e as Error).message === 'too large') throw new Error('This share link holds a diagram that is too large to open.', { cause: e })
    throw new Error('This share link is incomplete or damaged — it may have been cut off when it was copied.', { cause: e })
  }
  return parseDoc(JSON.parse(json))
}

export async function shareUrl(doc: Doc): Promise<string> {
  // `…/#/share#1.<payload>`: the app's own URL plus the hash route. The second `#` holds the diagram.
  return `${location.origin}${location.pathname}#/share#${await encodeDoc(doc)}`
}
