import { describe, expect, it } from 'vitest'
import { emptyDoc, makeNode, makeText, makeZone, defaultStyles } from './defaults'
import { recomputeMembership } from './membership'
import { arrangeDeltas, arrangeRoots, type Footprint } from './arrange'

const f = (id: string, x: number, y: number, w = 2, d = 2): Footprint => ({ id, x, y, w, d })

describe('align', () => {
  const items = [f('a', 0, 0), f('b', 5, 3, 4, 1), f('c', 2, 7)]
  it('aligns starts, ends and centres along x', () => {
    expect(Object.fromEntries(arrangeDeltas(items, { kind: 'align', axis: 'x', to: 'start' }))).toEqual({ b: { dx: -5, dy: 0 }, c: { dx: -2, dy: 0 } })
    expect(Object.fromEntries(arrangeDeltas(items, { kind: 'align', axis: 'x', to: 'end' }))).toEqual({ a: { dx: 7, dy: 0 }, c: { dx: 5, dy: 0 } })
    const mid = arrangeDeltas(items, { kind: 'align', axis: 'x', to: 'center' })
    expect(mid.get('a')).toEqual({ dx: 3.5, dy: 0 })
    expect(mid.get('b')).toEqual({ dx: -2.5, dy: 0 })
  })
  it('aligns along y', () => {
    expect(arrangeDeltas(items, { kind: 'align', axis: 'y', to: 'end' }).get('b')).toEqual({ dx: 0, dy: 5 })
  })
  it('does nothing for one item', () => {
    expect(arrangeDeltas([f('a', 3, 3)], { kind: 'align', axis: 'x', to: 'start' }).size).toBe(0)
  })
})

describe('distribute', () => {
  it('makes gaps equal and keeps the outer items', () => {
    const d = arrangeDeltas([f('a', 0, 0), f('b', 3, 0, 4), f('c', 12, 0), f('d', 9, 0)], { kind: 'distribute', axis: 'x' })
    // sizes 2+4+2+2 = 10 over span 14 → gap 4/3
    expect(d.has('a')).toBe(false)
    expect(d.has('c')).toBe(false)
    expect(d.get('b')!.dx).toBeCloseTo(2 + 4 / 3 - 3)
    expect(d.get('d')!.dx).toBeCloseTo(2 + 4 + (2 * 4) / 3 - 9)
  })
  it('needs three items', () => {
    expect(arrangeDeltas([f('a', 0, 0), f('b', 9, 0)], { kind: 'distribute', axis: 'x' }).size).toBe(0)
  })
})

describe('arrangeRoots', () => {
  it('skips items inside a selected zone and treats plain text as a point', () => {
    const doc = emptyDoc().pages[0]
    const s = defaultStyles()
    doc.zones.push(makeZone({ x: 0, y: 0, w: 10, d: 10 }))
    const zid = doc.zones[0].id
    doc.nodes.push({ ...makeNode({ x: 1, y: 1 }, s), id: 'inside' }, { ...makeNode({ x: 20, y: 0 }, s), id: 'out' })
    doc.texts.push({ ...makeText({ x: 30, y: 4, kind: 'text' }, s), id: 't' })
    recomputeMembership(doc)
    const roots = arrangeRoots(doc, [zid, 'inside', 'out', 't'])
    expect(roots.map((r) => r.id)).toEqual([zid, 'out', 't'])
    expect(roots[2]).toMatchObject({ w: 0, d: 0 })
  })
})
