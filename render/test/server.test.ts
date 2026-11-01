import { readFileSync } from 'node:fs'
import { afterAll, beforeAll, describe, expect, test } from 'vitest'
import { normalizeBasePath, startServer } from '../src/server'

const body = readFileSync(new URL('../../examples/minimal.archipen.json', import.meta.url))
const minimal = JSON.parse(body.toString())

describe.each(['', '/tools/api'])('base path "%s"', (base) => {
  let origin = ''
  let close: () => Promise<void>
  beforeAll(async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', basePath: base, maxBodyBytes: 64 * 1024 })
    origin = new URL(s.url).origin
    close = s.close
  })
  afterAll(() => close())
  const at = (p: string) => `${origin}${base}${p}`

  test.each([
    ['png', 'image/png'],
    ['svg', 'image/svg+xml; charset=utf-8'],
    ['pdf', 'application/pdf'],
  ])('POST /export?format=%s', async (format, type) => {
    const res = await fetch(at(`/export?format=${format}&theme=dark`), { method: 'POST', body })
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toBe(type)
    expect(res.headers.get('content-disposition')).toContain(`.${format}`)
    if (format === 'svg') expect(res.headers.get('content-security-policy')).toMatch(/default-src 'none'.*; sandbox$/)
    expect((await res.arrayBuffer()).byteLength).toBeGreaterThan(100)
  })

  test('healthz and usage', async () => {
    expect(await (await fetch(at('/healthz'))).text()).toBe('ok\n')
    expect(await (await fetch(at('/'))).text()).toContain(`POST ${base}/export`)
  })

  test('bad input', async () => {
    const invalid = await fetch(at('/export'), { method: 'POST', body: '{"format":"x"}' })
    expect(invalid.status).toBe(400)
    expect((await invalid.json()).issues.length).toBeGreaterThan(0)
    expect((await fetch(at('/export'), { method: 'POST', body: '{nope' })).status).toBe(400)
    expect((await fetch(at('/export?format=gif'), { method: 'POST', body })).status).toBe(400)
    expect((await fetch(at('/export?scale=99'), { method: 'POST', body })).status).toBe(400)
    expect((await fetch(at('/export'))).status).toBe(405)
    expect((await fetch(at('/export'), { method: 'POST', body: Buffer.alloc(100 * 1024, 32) })).status).toBe(413)
  })

  test('routing', async () => {
    expect((await fetch(at('/nothing'))).status).toBe(404)
    if (base) {
      const bare = await fetch(`${origin}${base}?x=1`, { redirect: 'manual' })
      expect(bare.status).toBe(308)
      expect(bare.headers.get('location')).toBe(`${base}/?x=1`)
      expect((await fetch(`${origin}/export`, { method: 'POST', body })).status).toBe(404)
      expect((await fetch(`${origin}/healthz`)).status).toBe(404)
    }
  })
})

describe('limits', () => {
  const gridPage = (n: number, p = '') => ({
    id: `p${p}`,
    nodes: Array.from({ length: n }, (_, i) => ({ id: `${p}n${i}`, x: (i % 50) * 4, y: Math.floor(i / 50) * 4 })),
    edges: Array.from({ length: n }, (_, i) => ({ id: `${p}e${i}`, from: { nodeId: `${p}n${i}` }, to: { nodeId: `${p}n${(i * 7 + 13) % n}` } })),
  })
  const grid = (n: number) => ({ ...minimal, pages: [gridPage(n)] })
  let url = ''
  let close: () => Promise<void>
  beforeAll(async () => {
    const s = await startServer({ port: 0, host: '127.0.0.1', workers: 1, maxQueue: 1, renderTimeoutMs: 1000, maxItems: 1000 })
    url = s.url
    close = s.close
  })
  afterAll(() => close())
  const post = (d: unknown, format = 'png') => fetch(`${url}export?format=${format}`, { method: 'POST', body: JSON.stringify(d) })

  test('far-away items are refused instead of allocating a huge image', async () => {
    const res = await post({ ...minimal, pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 1e6, y: 1e6 }] }] })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/too large/)
  })

  test('too many items are refused', async () => {
    const res = await post(grid(600))
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/1200 items/)
  })

  test('items on all pages count towards the limit', async () => {
    const res = await post({ ...minimal, pages: [gridPage(300, 'a'), gridPage(300, 'b')] })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/1200 items/)
  })
})

describe('render timeout', () => {
  // A stub worker that never finishes a `slow` diagram: a real slow render depends on how fast the machine is.
  let url = ''
  let close: () => Promise<void>
  beforeAll(async () => {
    const workerUrl = new URL('./fixtures/slow-worker.mjs', import.meta.url)
    const s = await startServer({ port: 0, host: '127.0.0.1', workers: 1, maxQueue: 1, renderTimeoutMs: 1000, workerUrl })
    url = s.url
    close = s.close
  })
  afterAll(() => close())
  const post = (d: unknown, format = 'png') => fetch(`${url}export?format=${format}`, { method: 'POST', body: JSON.stringify(d) })

  test('a slow render is stopped; the server keeps answering meanwhile and afterwards', async () => {
    const slow = post({ ...minimal, slow: true }, 'svg')
    await new Promise((r) => setTimeout(r, 200))
    const started = Date.now()
    expect((await fetch(`${url}healthz`)).status).toBe(200)
    expect(Date.now() - started).toBeLessThan(500)
    // One worker busy and room for one render in the queue: of two more, one waits and one is refused.
    // Both are in flight at once, so either may reach the server first.
    const queued = [post(minimal), post(minimal)]
    const res = await slow
    expect(res.status).toBe(422)
    expect((await res.json()).error).toMatch(/longer than 1 s/)
    const statuses = (await Promise.all(queued)).map((r) => r.status)
    expect(statuses.sort()).toEqual([200, 503])
  })
})

test('normalizeBasePath', () => {
  expect(normalizeBasePath(undefined)).toBe('')
  expect(normalizeBasePath('/')).toBe('')
  expect(normalizeBasePath('/a/b/')).toBe('/a/b')
  expect(() => normalizeBasePath('a')).toThrow()
})
