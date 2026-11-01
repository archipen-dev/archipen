// One render per message, off the server's main thread (see pool.ts).
import { parentPort } from 'node:worker_threads'
import { DiagramError, render, RenderLimitError, type Format, type RenderOptions } from './index'

export interface RenderJob {
  id: number
  raw: unknown
  format: Format
  opts: RenderOptions
}

export type RenderReply =
  | { id: number; ok: true; bytes: Uint8Array }
  | { id: number; ok: false; kind: 'diagram'; issues: DiagramError['issues'] }
  | { id: number; ok: false; kind: 'limit' | 'error'; message: string }

parentPort?.on('message', async ({ id, raw, format, opts }: RenderJob) => {
  let reply: RenderReply
  try {
    const bytes = await render(raw, format, opts)
    reply = { id, ok: true, bytes: new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength) }
  } catch (e) {
    const message = (e as Error).message
    if (e instanceof DiagramError) reply = { id, ok: false, kind: 'diagram', issues: e.issues }
    else if (e instanceof RenderLimitError) reply = { id, ok: false, kind: 'limit', message }
    else reply = { id, ok: false, kind: 'error', message }
  }
  parentPort!.postMessage(reply)
})
