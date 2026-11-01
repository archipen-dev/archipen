import { describe, expect, it } from 'vitest'
import { sampleDoc } from '../model/defaults'
import { decodeDoc, encodeDoc, MAX_SHARED_BYTES } from './shareLink'

describe('share links', () => {
  it('round-trips a diagram, custom icons included', async () => {
    const doc = sampleDoc()
    doc.assets = { a1: { id: 'a1', name: 'logo', viewBox: [0, 0, 24, 24], body: '<path d="M0 0h24v24H0z" fill="red"/>' } }
    doc.pages[0].nodes[0].icon = 'custom:a1'
    const payload = await encodeDoc(doc)
    expect(payload).toMatch(/^1\.[A-Za-z0-9_-]+$/)
    expect(await decodeDoc(payload)).toEqual(doc)
    expect(await decodeDoc('#' + payload)).toEqual(doc)
  })
  it('rejects damaged or truncated links', async () => {
    const payload = await encodeDoc(sampleDoc())
    await expect(decodeDoc(payload.slice(0, payload.length / 2))).rejects.toThrow()
    await expect(decodeDoc('2.abc')).rejects.toThrow(/not valid/)
  })
  it('refuses links that unpack to more than the limit', async () => {
    const bomb = new Blob([new Uint8Array(MAX_SHARED_BYTES + 1024).fill(32)]).stream().pipeThrough(new CompressionStream('deflate-raw'))
    const packed = Buffer.from(await new Response(bomb).arrayBuffer())
    expect(packed.length).toBeLessThan(100_000)
    await expect(decodeDoc(`1.${packed.toString('base64url')}`)).rejects.toThrow(/too large/)
  })
})
