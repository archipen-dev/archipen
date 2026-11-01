import { readdirSync, readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { DiagramError, renderPdf, renderPng, renderSvg, validateDiagram } from '../src/index'

const dir = new URL('../../examples/', import.meta.url)
const examples = readdirSync(dir).filter((f) => f.endsWith('.archipen.json'))
const read = (f: string) => readFileSync(new URL(f, dir), 'utf8')
const minimal = () => JSON.parse(read('minimal.archipen.json'))

const pngSize = (b: Buffer) => ({ w: b.readUInt32BE(16), h: b.readUInt32BE(20) })
const svgSize = (s: string) => {
  const m = /<svg[^>]* width="(\d+)" height="(\d+)"/.exec(s)!
  return { w: Number(m[1]), h: Number(m[2]) }
}

describe.each(examples)('%s', (file) => {
  test.each(['light', 'dark'] as const)('renders SVG, PNG and PDF (%s)', async (theme) => {
    const raw = read(file)
    const svg = await renderSvg(raw, { theme })
    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toMatch(/<svg xmlns="http:\/\/www.w3.org\/2000\/svg"[^>]* viewBox="/)
    expect(svg).not.toMatch(/data-id|data-kind|ap-hit|ap-flow/)
    expect(svg).toContain('@font-face')
    expect(svg).toMatch(/<svg [^>]*role="graphics-document"/)
    expect(svg).toMatch(/<title id="ap-title">[^<]+<\/title><desc id="ap-desc">Diagram with /)

    const png = await renderPng(raw, { theme, scale: 1 })
    expect(png.subarray(0, 8)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    // PNG shows the first page; the SVG of a multi-page file is as big as its largest page.
    expect(pngSize(png)).toEqual(svgSize(await renderSvg(raw, { theme, page: JSON.parse(raw).pages[0].id })))

    const pdf = await renderPdf(raw, { theme })
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-')
  })
})

test('PNG scale multiplies the pixel size', async () => {
  const doc = minimal()
  const { w, h } = svgSize(await renderSvg(doc))
  expect(pngSize(await renderPng(doc, { scale: 2 }))).toEqual({ w: w * 2, h: h * 2 })
})

test('options: transparent, animated, no font', async () => {
  const doc = minimal()
  const plain = await renderSvg(doc, { background: false, embedFont: false })
  expect(plain).not.toContain('@font-face')
  expect(plain).not.toMatch(/<\/desc><rect/)
  expect(await renderSvg(doc)).toMatch(/<\/desc><rect/)
  const withFlow = structuredClone(doc)
  withFlow.pages[0].edges = withFlow.pages[0].edges.map((e: object) => ({ ...e, flow: { enabled: true } }))
  if (withFlow.pages[0].edges.length) expect(await renderSvg(withFlow, { animate: true })).toContain('ap-flow')
})

test('custom icons are sanitised', async () => {
  const doc = minimal()
  doc.assets = { evil: { id: 'evil', name: 'evil', viewBox: [0, 0, 24, 24], body: '<script>alert(1)</script><circle cx="12" cy="12" r="10" onclick="alert(2)"/>' } }
  doc.pages[0].nodes[0].icon = 'custom:evil'
  const svg = await renderSvg(doc)
  expect(svg).toContain('<circle')
  expect(svg).not.toMatch(/<script|onclick|alert/)
})

test('invalid files throw DiagramError with issues', async () => {
  await expect(renderSvg('{"format":"nope"}')).rejects.toBeInstanceOf(DiagramError)
  const { doc, issues } = await validateDiagram('not json')
  expect(doc).toBeNull()
  expect(issues[0].message).toMatch(/not valid JSON/)
})

test('custom icons cannot reference files on disk', async () => {
  const png = new URL('../../app/public/favicon.svg', import.meta.url).pathname
  const svg = await renderSvg({
    ...minimal(),
    pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0, icon: 'custom:i' }] }],
    assets: { i: { id: 'i', name: 'i', viewBox: [0, 0, 24, 24], body: `<image xmlns:x="http://www.w3.org/1999/xlink" x:href="${png}" width="24" height="24"/>` } },
  })
  expect(svg).toContain('<image')
  expect(svg).not.toContain(png)
})


describe('pages', () => {
  const drill = read('drill-down.archipen.json')
  const pdfPages = (b: Buffer) => b.toString('latin1').match(/\/Type \/Page\b/g)?.length ?? 0

  test('SVG holds every page with clickable links, or just the one asked for', async () => {
    const all = await renderSvg(drill)
    expect(all.match(/class="ap-page/g)).toHaveLength(3)
    expect(all).toContain('<a href="#ap-page-checkout-detail">')
    const detail = await renderSvg(drill, { page: 'checkout-detail' })
    expect(detail).toContain('aria-label="Payments')
    expect(detail).not.toContain('aria-label="Customers')
    expect(detail).not.toContain('ap-page')
  })

  test('PNG draws the first page unless another is asked for', async () => {
    const first = svgSize(await renderSvg(drill, { page: 'overview' }))
    expect(pngSize(await renderPng(drill, { scale: 1 }))).toEqual(first)
    expect(pngSize(await renderPng(drill, { scale: 1, page: 'data-detail' }))).toEqual(svgSize(await renderSvg(drill, { page: 'data-detail' })))
  })

  test('PDF has one page per diagram page, or just the one asked for', async () => {
    expect(pdfPages(await renderPdf(drill))).toBe(3)
    expect(pdfPages(await renderPdf(drill, { page: 'data-detail' }))).toBe(1)
  })

  test('empty pages are left out of the PDF', async () => {
    const doc = minimal()
    doc.pages.push({ id: 'empty' })
    expect(pdfPages(await renderPdf(doc))).toBe(1)
  })

  test('an unknown page is an error naming the pages there are', async () => {
    await expect(renderSvg(drill, { page: 'nope' })).rejects.toThrow(/No page with id "nope".*"overview"/)
  })
})
