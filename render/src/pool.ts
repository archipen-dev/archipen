// A fixed set of worker threads that render diagrams, so a slow render never blocks the HTTP server.
// Each render has a time limit: a worker that runs over it is terminated and replaced.
import { existsSync } from 'node:fs'
import { Worker } from 'node:worker_threads'
import type { Format, RenderOptions } from './index'
import type { RenderJob, RenderReply } from './worker'

export interface PoolOptions {
  /** Number of worker threads. */
  workers: number
  /** Renders waiting for a free worker before new ones are refused. */
  maxQueue: number
  /** Milliseconds a single render may take. */
  timeoutMs: number
  /** The built worker script. Default: worker.mjs from the package's dist/. */
  workerUrl?: URL
}

/** Why a render did not produce a file. */
export class RenderFailure extends Error {
  constructor(
    public kind: 'diagram' | 'limit' | 'timeout' | 'busy' | 'error',
    message: string,
    public issues: Extract<RenderReply, { kind: 'diagram' }>['issues'] = [],
  ) {
    super(message)
  }
}

/**
 * worker.mjs sits in dist/. This module is in dist/ or dist/chunks/ once built,
 * and in src/ when the tests run it (they build first).
 */
function defaultWorkerUrl(): URL {
  const url = ['./worker.mjs', '../worker.mjs', '../dist/worker.mjs'].map((p) => new URL(p, import.meta.url)).find((u) => existsSync(u))
  if (!url) throw new Error('@archipen/render: dist/worker.mjs not found (run "npm run build" in render/)')
  return url
}

interface Job {
  msg: RenderJob
  resolve: (bytes: Buffer) => void
  reject: (e: Error) => void
}

interface Slot {
  worker: Worker
  job?: Job
  timer?: NodeJS.Timeout
}

export class RenderPool {
  private slots: Slot[] = []
  private queue: Job[] = []
  private nextId = 1
  private closed = false
  private readonly url: URL

  constructor(private opts: PoolOptions) {
    this.url = opts.workerUrl ?? defaultWorkerUrl()
    for (let i = 0; i < Math.max(1, opts.workers); i++) this.slots.push(this.spawn())
  }

  render(raw: unknown, format: Format, opts: RenderOptions): Promise<Buffer> {
    if (this.closed) return Promise.reject(new RenderFailure('busy', 'The server is shutting down'))
    if (this.queue.length >= this.opts.maxQueue) return Promise.reject(new RenderFailure('busy', 'The server is busy, try again shortly'))
    return new Promise((resolve, reject) => {
      this.queue.push({ msg: { id: this.nextId++, raw, format, opts }, resolve, reject })
      this.dispatch()
    })
  }

  async close(): Promise<void> {
    this.closed = true
    for (const job of this.queue.splice(0)) job.reject(new RenderFailure('busy', 'The server is shutting down'))
    await Promise.all(this.slots.map((s) => this.finish(s, new RenderFailure('busy', 'The server is shutting down'))))
  }

  private spawn(): Slot {
    // Workers don't keep the process alive: a server that stops listening can exit.
    // execArgv: []: the host process's own Node flags (loaders, --input-type, …) don't apply to the worker.
    const worker = new Worker(this.url, { execArgv: [], resourceLimits: { maxOldGenerationSizeMb: 512 } })
    worker.unref()
    const slot: Slot = { worker }
    worker.on('message', (reply: RenderReply) => {
      const job = slot.job
      if (!job || job.msg.id !== reply.id) return
      this.done(slot)
      if (reply.ok) job.resolve(Buffer.from(reply.bytes.buffer, reply.bytes.byteOffset, reply.bytes.byteLength))
      else if (reply.kind === 'diagram') job.reject(new RenderFailure('diagram', 'Not a valid Archipen file', reply.issues))
      else job.reject(new RenderFailure(reply.kind, reply.message))
      this.dispatch()
    })
    // A crash (out of memory, a native abort) ends only this worker: fail its job and start a new one.
    worker.on('error', (e: Error) => this.replace(slot, new RenderFailure('error', `Rendering failed: ${e.message}`)))
    worker.on('exit', () => this.replace(slot, new RenderFailure('error', 'Rendering failed')))
    return slot
  }

  private dispatch() {
    for (const slot of this.slots) {
      if (slot.job || !this.queue.length) continue
      const job = this.queue.shift()!
      slot.job = job
      slot.timer = setTimeout(() => {
        const s = Math.round(this.opts.timeoutMs / 1000)
        this.replace(slot, new RenderFailure('timeout', `Rendering took longer than ${s} s; the diagram is too complex`))
      }, this.opts.timeoutMs)
      slot.worker.postMessage(job.msg)
    }
  }

  private done(slot: Slot) {
    clearTimeout(slot.timer)
    slot.job = slot.timer = undefined
  }

  /** Reject the slot's running job, if any, and stop its worker. */
  private finish(slot: Slot, err: Error): Promise<number> {
    const job = slot.job
    this.done(slot)
    job?.reject(err)
    slot.worker.removeAllListeners()
    slot.worker.on('error', () => {}) // a late error from a worker being stopped is expected
    return slot.worker.terminate()
  }

  private replace(slot: Slot, err: Error) {
    const i = this.slots.indexOf(slot)
    if (i < 0) return
    void this.finish(slot, err)
    if (this.closed) return
    this.slots[i] = this.spawn()
    this.dispatch()
  }
}
