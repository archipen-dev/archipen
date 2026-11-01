import { describe, expect, it } from 'vitest'
import { buildScene } from '../geometry/scene'
import { pageView } from './pages'
import { validateDoc } from './parse'
import { flaggedItems, hiddenIds, lockedIds, withoutHidden } from './visibility'

const base = (extra: object = {}) => {
  const { doc, issues } = validateDoc({
    format: 'archipen',
    pages: [
      {
        id: 'p',
        zones: [{ id: 'z', x: 0, y: 0, w: 8, d: 6 }],
    nodes: [
      { id: 'a', x: 1, y: 1 },
      { id: 'b', x: 12, y: 1 },
    ],
    edges: [
      { id: 'e-ab', from: { nodeId: 'a' }, to: { nodeId: 'b' } },
      { id: 'e-bz', from: { nodeId: 'b' }, to: { zoneId: 'z' } },
    ],
        ...extra,
      },
    ],
  })
  return { doc: doc && pageView(doc), issues }
}

describe('wires to zones in files', () => {
  it('loads a wire that ends on a zone and draws it', () => {
    const { doc, issues } = base()
    expect(issues).toEqual([])
    const scene = buildScene(doc!, 'iso')
    expect(scene.edges.map((e) => e.edge.id)).toEqual(['e-ab', 'e-bz'])
  })
  it('rejects an end with both ids, and a zoneId that names a node', () => {
    const { issues } = base({ edges: [{ id: 'e1', from: { nodeId: 'a', zoneId: 'z' }, to: { nodeId: 'b' } }, { id: 'e2', from: { zoneId: 'a' }, to: { nodeId: 'b' } }] })
    const errors = issues.filter((i) => i.level === 'error')
    expect(errors.some((i) => i.path.startsWith('pages[0].edges[0].from') && /not both/.test(i.message))).toBe(true)
  })
  it('says which field to use when the id names the other kind', () => {
    const { issues } = base({ edges: [{ id: 'e2', from: { zoneId: 'a' }, to: { nodeId: 'b' } }] })
    expect(issues).toContainEqual(expect.objectContaining({ level: 'error', path: 'pages[0].edges[0].from.zoneId', message: expect.stringMatching(/use "nodeId"/) }))
  })
})

describe('lock and hide', () => {
  it('a hidden zone hides its contents and every wire touching them', () => {
    const { doc } = base({ zones: [{ id: 'z', x: 0, y: 0, w: 8, d: 6, hidden: true }] })
    expect([...hiddenIds(doc!)].sort()).toEqual(['a', 'e-ab', 'e-bz', 'z'])
    const scene = buildScene(doc!, 'iso')
    expect(scene.nodes.map((n) => n.node.id)).toEqual(['b'])
    expect(scene.edges).toEqual([])
    expect(scene.zones).toEqual([])
  })
  it('a hidden wire hides only itself, and nothing hidden keeps the same doc', () => {
    const { doc } = base({ edges: [{ id: 'e-ab', from: { nodeId: 'a' }, to: { nodeId: 'b' }, hidden: true }] })
    expect([...hiddenIds(doc!)]).toEqual(['e-ab'])
    const plain = base().doc!
    expect(withoutHidden(plain)).toBe(plain)
  })
  it('a locked zone locks what is inside it; the list only shows what the user flagged', () => {
    const { doc } = base({ zones: [{ id: 'z', x: 0, y: 0, w: 8, d: 6, locked: true }] })
    expect([...lockedIds(doc!)].sort()).toEqual(['a', 'z'])
    expect(flaggedItems(doc!)).toEqual([{ id: 'z', kind: 'zone', name: '', locked: true, hidden: false }])
  })
})
