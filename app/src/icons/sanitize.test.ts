// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { parseDoc } from '../model/defaults'
import { sanitizeAssetBody, sanitizeSvg } from './sanitize'

/** What the browser would build from the markup: every element name and attribute. */
function parsed(body: string) {
  const svg = new DOMParser().parseFromString(`<!doctype html><body><svg>${body}</svg>`, 'text/html').body
  return Array.from(svg.querySelectorAll('*')).map((el) => ({ tag: el.localName.toLowerCase(), attrs: Array.from(el.attributes).map((a) => [a.name, a.value]) }))
}

describe('icon sanitizing', () => {
  it('keeps ordinary SVG markup', () => {
    const body = '<path d="M0 0h24v24z" fill="#5b7cfa"></path><circle cx="12" cy="12" r="4"></circle>'
    expect(sanitizeAssetBody(body)).toBe(body)
  })

  it.each([
    ['script', '<script>alert(1)</script><path d="M0 0"></path>'],
    ['event handler', '<path d="M0 0" onload="alert(1)"></path>'],
    ['href animation', '<a href="#x"><set attributeName="href" to="javascript:alert(1)"></set><path d="M0 0"></path></a>'],
    ['javascript href', '<use href="javascript:alert(1)"></use>'],
    ['HTML breakout', '<p></p><img src="x" onerror="alert(1)">'],
    ['foreignObject', '<foreignObject><div onclick="alert(1)">x</div></foreignObject>'],
    ['style breakout', '<style>.a{}&lt;/style&gt;&lt;img src=x onerror=alert(1)&gt;</style>'],
  ])('removes %s', (_, body) => {
    const out = sanitizeAssetBody(body)
    for (const el of parsed(out)) {
      expect(['script', 'img', 'p', 'a', 'set', 'foreignobject', 'div']).not.toContain(el.tag)
      for (const [name, value] of el.attrs) {
        expect(name).not.toMatch(/^on/i)
        expect(value).not.toMatch(/javascript:/i)
      }
    }
    // Parsing the cleaned markup again (as the canvas does) must not bring anything back.
    expect(sanitizeAssetBody(out)).toBe(out)
  })

  it.each([
    ['a self-declared xlink prefix', '<image xmlns:x="http://www.w3.org/1999/xlink" x:href="/etc/secret.png" width="24" height="24"></image>'],
    ['a plain file href', '<image href="/etc/secret.png"></image>'],
    ['a file URL', '<image xlink:href="file:///etc/secret.png"></image>'],
    ['a nested SVG document', '<image href="data:image/svg+xml,%3Csvg%3E%3C/svg%3E"></image>'],
  ])('drops image references to %s', (_, body) => {
    for (const el of parsed(sanitizeAssetBody(body))) {
      for (const [name] of el.attrs) expect(name).not.toMatch(/href|xmlns|:/i)
    }
  })

  it('keeps embedded raster images and local references', () => {
    const body = '<image href="data:image/png;base64,iVBORw0KGgo=" width="4" height="4"></image><use href="#a"></use>'
    expect(sanitizeAssetBody(body)).toBe(body)
  })

  it.each([
    ['an escaped @import', '<style>@\\69mport "https://evil.example/x.css";</style>'],
    ['an escaped url()', '<style>.apx-a{fill:u\\72l(https://evil.example/a)}</style>'],
    ['a page-wide selector', '<style>body{display:none}</style>'],
    ['a selector outside the icon', '<style>.apx-a, button{opacity:0}</style>'],
    ['a style attribute with an escape', '<rect style="fill:u\\72l(https://evil.example/a)"></rect>'],
    ['a presentation attribute with an escape', '<rect fill="u\\72l(https://evil.example/a)"></rect>'],
  ])('removes CSS with %s', (_, body) => {
    const out = sanitizeAssetBody(body)
    expect(out).not.toMatch(/evil|body|button|\\/)
  })

  it('keeps stylesheets scoped to the icon', () => {
    const body = '<style>.apx1-a, #apx1-b .apx1-c{fill:#5b7cfa;stroke:url(#apx1-g)}</style><rect class="apx1-a"></rect>'
    expect(sanitizeAssetBody(body)).toBe(body)
  })

  it('keeps class-based styles in uploaded SVGs', () => {
    const a = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><style>.cls-1{fill:#f00}</style><rect class="cls-1" width="10" height="10"/></svg>', 'x1', 'icon')
    expect(a.body).toContain('<style>.apx1-cls-1{fill:#f00}</style>')
  })

  it('cleans assets in files opened from disk', () => {
    const doc = parseDoc({
      format: 'archipen',
      pages: [{ id: 'p', nodes: [{ id: 'n', x: 0, y: 0, icon: 'custom:i' }] }],
      assets: { i: { id: 'i', name: 'evil', viewBox: [0, 0, 24, 24], body: '<path d="M0 0"></path><script>alert(1)</script>' } },
    })
    expect(doc.assets.i.body).toBe('<path d="M0 0"></path>')
  })

  it('still prefixes ids in uploaded SVGs', () => {
    const a = sanitizeSvg('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><defs><linearGradient id="g"></linearGradient></defs><rect fill="url(#g)" width="10" height="10"/></svg>', 'x1', 'icon')
    expect(a.viewBox).toEqual([0, 0, 10, 10])
    expect(a.body).toContain('id="apx1-g"')
    expect(a.body).toContain('url(#apx1-g)')
  })
})
