import { produce } from 'immer'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { findEntity } from './entities'
import { itemCount, linksTo, pageById, pageOfItem, pageView, removePage } from './pages'
import { parseDoc, validateDoc } from './parse'

const page = (id: string, extra: object = {}) => ({ id, ...extra })
const file = (...pages: object[]) => ({ format: 'archipen', pages })
const paths = (raw: unknown, level: 'error' | 'warning') =>
  validateDoc(raw)
    .issues.filter((i) => i.level === level)
    .map((i) => i.path)

describe('pages in files', () => {
  it('a file without pages gets one empty page', () => {
    const doc = parseDoc({ format: 'archipen' })
    expect(doc.pages).toEqual([{ id: 'main', name: 'Main', description: '', nodes: [], zones: [], edges: [], texts: [] }])
  })

  it('rejects items at the top level instead of dropping them', () => {
    const { doc, issues } = validateDoc({ format: 'archipen', nodes: [{ id: 'a', x: 0, y: 0 }] })
    expect(doc).toBeNull()
    expect(issues).toEqual([{ level: 'error', path: 'nodes', message: expect.stringMatching(/inside a page/) }])
  })

  it('rejects an empty page list', () => {
    expect(paths({ format: 'archipen', pages: [] }, 'error')).toEqual(['pages'])
  })

  it('page ids are unique', () => {
    expect(paths(file(page('a'), page('a')), 'error')).toEqual(['pages[1].id'])
  })

  it('item ids are unique across pages', () => {
    const raw = file(page('a', { nodes: [{ id: 'n', x: 0, y: 0 }] }), page('b', { zones: [{ id: 'n', x: 0, y: 0, w: 2, d: 2 }] }))
    expect(validateDoc(raw).issues).toEqual([
      { level: 'error', path: 'pages[1].zones[0].id', message: expect.stringMatching(/Duplicate id "n".*all pages/) },
    ])
  })

  it('wires connect items on their own page', () => {
    const raw = file(
      page('a', { nodes: [{ id: 'x', x: 0, y: 0 }] }),
      page('b', { nodes: [{ id: 'y', x: 0, y: 0 }], edges: [{ id: 'e', from: { nodeId: 'x' }, to: { nodeId: 'y' } }] }),
    )
    expect(validateDoc(raw).issues).toEqual([{ level: 'error', path: 'pages[1].edges[0].from.nodeId', message: expect.stringMatching(/another page/) }])
  })

  it('warns about links to missing pages and to the own page, but loads', () => {
    const raw = file(
      page('a', {
        nodes: [
          { id: 'n1', x: 0, y: 0, link: { page: 'b' } },
          { id: 'n2', x: 4, y: 0, link: { page: 'nope' } },
        ],
        zones: [{ id: 'z', x: 10, y: 0, w: 2, d: 2, link: { page: 'a' } }],
      }),
      page('b', { nodes: [{ id: 'back', x: 0, y: 0, link: { page: 'a' } }] }),
    )
    const { doc, issues } = validateDoc(raw)
    expect(doc).not.toBeNull()
    expect(issues).toEqual([
      { level: 'warning', path: 'pages[0].nodes[1].link.page', message: expect.stringMatching(/No page with id "nope"/) },
      { level: 'warning', path: 'pages[0].zones[0].link.page', message: expect.stringMatching(/own page/) },
    ])
  })

  it('derives zone membership per page', () => {
    const doc = parseDoc(
      file(page('a', { zones: [{ id: 'z', x: 0, y: 0, w: 4, d: 4 }] }), page('b', { nodes: [{ id: 'n', x: 1, y: 1 }] })),
    )
    expect(doc.pages[1].nodes[0].zoneId).toBeUndefined()
  })

  it('the drill-down example links its pages', () => {
    const doc = parseDoc(JSON.parse(readFileSync(new URL('../../../examples/drill-down.archipen.json', import.meta.url), 'utf8')))
    expect(doc.pages.map((p) => p.id)).toEqual(['overview', 'checkout-detail', 'data-detail'])
    expect(linksTo(doc, 'checkout-detail').map((l) => l.itemId)).toEqual(['checkout'])
  })
})

describe('page helpers', () => {
  const doc = parseDoc(
    file(
      page('a', { name: 'A', nodes: [{ id: 'n1', x: 0, y: 0, link: { page: 'b' } }] }),
      page('b', { name: 'B', nodes: [{ id: 'n2', x: 0, y: 0 }], texts: [{ id: 't', kind: 'text', x: 0, y: 3 }] }),
    ),
  )

  it('pageView shows one page with the diagram settings, and falls back to the first page', () => {
    const v = pageView(doc, 'b')
    expect(v).toMatchObject({ pageId: 'b', pageName: 'B', name: doc.name, settings: doc.settings })
    expect(v.nodes.map((n) => n.id)).toEqual(['n2'])
    expect(pageView(doc, 'b')).toBe(v)
    expect(pageView(doc, 'gone').pageId).toBe('a')
    expect(pageView(doc).pageId).toBe('a')
    expect(pageById(doc, null).id).toBe('a')
  })

  it('finds items on any page', () => {
    expect(pageOfItem(doc, 't')?.id).toBe('b')
    expect(findEntity(doc, 'n2')?.kind).toBe('node')
    expect(findEntity(pageView(doc, 'a'), 'n2')).toBeNull()
    expect(itemCount(doc)).toBe(3)
  })

  it('removing a page removes the links to it, and keeps the last page', () => {
    const next = produce(doc, (d) => removePage(d, 'b'))
    expect(next.pages.map((p) => p.id)).toEqual(['a'])
    expect(next.pages[0].nodes[0].link).toBeUndefined()
    expect(produce(next, (d) => removePage(d, 'a')).pages).toHaveLength(1)
  })
})
