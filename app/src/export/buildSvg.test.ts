import { describe, expect, it } from 'vitest'
import { emptyDoc, makeNode, parseDoc, sampleDoc } from '../model/defaults'
import { LIGHT } from '../render/theme'
import { renderPagesSvg, renderSvgString } from './buildSvg'
import { EmptyDiagramError } from './limits'

describe('accessible SVG export', () => {
  it('names the document and every item, and hides labels and icons', () => {
    const d = sampleDoc()
    const { svg } = renderSvgString(d, { theme: LIGHT })
    expect(svg).toMatch(/<svg [^>]*role="graphics-document"[^>]*aria-labelledby="ap-title"[^>]*aria-describedby="ap-desc"/)
    expect(svg).toContain(`<title id="ap-title">${d.name}</title>`)
    expect(svg).toMatch(/<desc id="ap-desc">Diagram with \d+ nodes/)
    const symbols = svg.match(/role="graphics-symbol" aria-roledescription="node"/g) ?? []
    expect(symbols).toHaveLength(d.pages[0].nodes.filter((n) => !n.hidden).length)
    expect(svg).toMatch(/aria-roledescription="connection" aria-label="Connection /)
    // Titles stay on their shapes, labels and icons are hidden.
    expect(svg).toMatch(/<g role="graphics-symbol" aria-roledescription="node" aria-label="[^"]*"><title>/)
    expect(svg).not.toMatch(/<\/desc>(<rect[^>]*>)?<title>/)
    expect(svg).toMatch(/<g transform="[^"]*" aria-hidden="true">/)
    expect(svg).toMatch(/<g aria-hidden="true"><g transform="[^"]*" font-family/)
  })

  it('escapes names', () => {
    const d = emptyDoc('A & <B>')
    d.pages[0].nodes = [makeNode({ id: 'x', name: 'a<b', x: 0, y: 0 })]
    const { svg } = renderSvgString(parseDoc(d), { theme: LIGHT })
    expect(svg).toContain('<title id="ap-title">A &amp; &lt;B&gt;</title>')
    expect(svg).toContain('aria-label="a&lt;b"')
  })
})

describe('pages', () => {
  const doc = parseDoc({
    format: 'archipen',
    name: 'Shop',
    pages: [
      { id: 'a', name: 'Overview', nodes: [{ id: 'x', name: 'Checkout', x: 0, y: 0, link: { page: 'b' } }] },
      { id: 'b', name: 'Inside', nodes: [{ id: 'y', name: 'Payments', x: 0, y: 0 }] },
      { id: 'c', name: 'Empty' },
    ],
  })

  it('draws one page when asked, without links', () => {
    const inside = renderSvgString(doc, { theme: LIGHT, page: 'b' }).svg
    expect(inside).toContain('aria-label="Payments"')
    expect(inside).not.toContain('Checkout')
    expect(renderSvgString(doc, { theme: LIGHT, page: 'a' }).svg).not.toContain('<a ')
  })

  it('puts every page in one file, the first one last and shown by default, with clickable links', () => {
    const { svg } = renderSvgString(doc, { theme: LIGHT })
    const pages = [...svg.matchAll(/<svg id="([^"]+)" class="([^"]+)"/g)].map((m) => `${m[1]} ${m[2]}`)
    expect(pages).toEqual(['ap-page-b ap-page', 'ap-page-a ap-page ap-start'])
    expect(svg).toContain('.ap-page:target~.ap-start{display:none}')
    expect(svg).toMatch(/<a href="#ap-page-b"><g role="graphics-symbol" aria-roledescription="node" aria-label="Checkout. Details on page Inside.">/)
    expect(svg).toMatch(/<a href="#ap-page-a"><text[^>]*>‹ Overview<\/text><\/a>/)
    expect(svg).toContain('<desc id="ap-desc">Diagram with 2 pages: Overview, Inside.')
  })

  it('links to empty or missing pages are not clickable', () => {
    const d = parseDoc({
      format: 'archipen',
      pages: [
        { id: 'a', nodes: [{ id: 'x', x: 0, y: 0, link: { page: 'c' } }, { id: 'z', x: 4, y: 0, link: { page: 'b' } }] },
        { id: 'b', nodes: [{ id: 'y', x: 0, y: 0 }] },
        { id: 'c' },
      ],
    })
    const { svg } = renderSvgString(d, { theme: LIGHT })
    expect(svg.match(/<a href=/g)).toHaveLength(2) // the link to b and b's back link
    expect(svg).not.toContain('#ap-page-c')
  })

  it('a diagram with only one non-empty page exports like a one-page diagram', () => {
    const d = parseDoc({ format: 'archipen', pages: [{ id: 'a', nodes: [{ id: 'x', x: 0, y: 0 }] }, { id: 'b' }] })
    expect(renderSvgString(d, { theme: LIGHT }).svg).not.toContain('ap-page')
  })

  it('says which page is empty', () => {
    expect(() => renderSvgString(doc, { theme: LIGHT, page: 'c' })).toThrow(EmptyDiagramError)
    expect(() => renderSvgString(doc, { theme: LIGHT, page: 'c' })).toThrow(/page "Empty" is empty/)
  })

  it('renders every page with something on it, for PDF', () => {
    expect(renderPagesSvg(doc, { theme: LIGHT }).map((p) => p.pageName)).toEqual(['Overview', 'Inside'])
    expect(() => renderPagesSvg(parseDoc({ format: 'archipen' }), { theme: LIGHT })).toThrow(EmptyDiagramError)
  })
})
