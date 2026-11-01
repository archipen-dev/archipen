import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { build, type Plugin } from 'vite'
import { CSP_HEADER } from '../csp.ts'

const appDir = fileURLToPath(new URL('..', import.meta.url))
const TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain',
}

export interface ProdServer {
  /** e.g. http://127.0.0.1:41234 */
  origin: string
  /** Shut the server down, as if the network were gone. */
  close: () => Promise<void>
  /** Build again, with `build-marker.txt` holding `marker`, so the service worker sees a new version. */
  rebuild: (marker: string) => Promise<void>
}

/** An extra file in the build. The worker precaches it, so a new marker makes a new worker. */
const marker = (text: string): Plugin => ({
  name: 'test-build-marker',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'build-marker.txt', source: text })
  },
})

/**
 * Build the app for production into test-results/<name>/ and serve it under `base` from a plain static file server
 * (no rewrites), with the same CSP header as deploy/Caddyfile. The dev server the other specs use has no service worker.
 */
export async function serveProdBuild(name: string, base: string): Promise<ProdServer> {
  const outDir = join(appDir, 'test-results', name)
  const rebuild = (text: string) => build({ root: appDir, logLevel: 'error', build: { outDir, emptyOutDir: true }, plugins: [marker(text)] }).then(() => {})
  await rebuild('1')
  const server: Server = createServer((req, res) => {
    const path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname)
    if (!path.startsWith(base)) return res.writeHead(404).end()
    let file = join(outDir, path.slice(base.length))
    if (existsSync(file) && statSync(file).isDirectory()) file = join(file, 'index.html')
    if (!file.startsWith(outDir) || !existsSync(file)) return res.writeHead(404).end()
    res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream', 'content-security-policy': CSP_HEADER })
    createReadStream(file).pipe(res)
  })
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done))
  let closed = false
  return {
    origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`,
    rebuild,
    close: () =>
      new Promise<void>((done) => {
        if (closed) return done()
        closed = true
        server.closeAllConnections()
        server.close(() => done())
      }),
  }
}
