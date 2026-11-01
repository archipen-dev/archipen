import { describe, expect, it } from 'vitest'
import { buildScene } from '../geometry/scene'
import { emptyDoc, makeEdge, makeNode, makeText, makeZone, parseDoc } from '../model/defaults'
import { pageView } from '../model/pages'
import { a11yLabel, a11yOrder, describeChanges, describeScene } from './describe'

function doc() {
  const d = emptyDoc('Shop')
  d.pages[0].zones = [makeZone({ id: 'vpc', name: 'VPC', x: 0, y: 0, w: 12, d: 6 })]
  d.pages[0].nodes = [
    makeNode({ id: 'api', name: 'API', description: 'REST  gateway', x: 1, y: 1 }),
    makeNode({ id: 'db', name: 'Postgres', shape: 'cylinder', x: 6, y: 1 }),
    makeNode({ id: 'anon', name: '', x: 20, y: 1 }),
    makeNode({ id: 'secret', name: 'Hidden', hidden: true, x: 20, y: 6 }),
  ]
  d.pages[0].edges = [
    makeEdge({ id: 'e1', name: 'queries', from: { nodeId: 'api' }, to: { nodeId: 'db' }, arrows: 'end' }),
    makeEdge({ id: 'e2', from: { nodeId: 'api' }, to: { nodeId: 'anon' }, arrows: 'both' }),
    makeEdge({ id: 'e3', from: { nodeId: 'db' }, to: { nodeId: 'anon' }, arrows: 'start' }),
    makeEdge({ id: 'e4', from: { nodeId: 'api' }, to: { zoneId: 'vpc' }, arrows: 'none' }),
    makeEdge({ id: 'e5', from: { nodeId: 'api' }, to: { nodeId: 'secret' } }),
  ]
  d.pages[0].texts = [makeText({ id: 'n1', kind: 'note', name: 'TODO', description: 'add cache', x: 2, y: 8 })]
  return parseDoc(JSON.parse(JSON.stringify(d)))
}

describe('describeScene', () => {
  const { summary, items } = describeScene(buildScene(pageView(doc()), 'iso'))

  it('describes nodes, with kind, description and an id fallback', () => {
    expect(items.get('api')).toMatchObject({ role: 'node', text: 'API: REST gateway' })
    expect(items.get('db')?.text).toBe('Postgres (database)')
    expect(items.get('anon')?.text).toBe('anon')
  })

  it('words connections by their arrows', () => {
    expect(items.get('e1')).toEqual({ role: 'connection', text: 'Connection API to Postgres: queries' })
    expect(items.get('e2')?.text).toBe('Connection between API and anon, both ways')
    expect(items.get('e3')?.text).toBe('Connection anon to Postgres')
    expect(items.get('e4')?.text).toBe('Connection API connected to VPC')
  })

  it('lists what a zone contains', () => {
    expect(items.get('vpc')).toMatchObject({ role: 'zone', text: 'Zone VPC. Contains API, Postgres.' })
  })

  it('describes notes', () => {
    expect(items.get('n1')).toEqual({ role: 'note', text: 'Note: TODO. add cache' })
  })

  it('leaves out hidden items and wires to them', () => {
    expect(items.has('secret')).toBe(false)
    expect(items.has('e5')).toBe(false)
    expect(summary).not.toContain('Hidden')
  })

  it('summarises in reading order', () => {
    expect(summary.split('\n')).toEqual([
      'Diagram with 3 nodes, 4 connections, 1 zone.',
      'Zone VPC. Contains API, Postgres.',
      'API: REST gateway.',
      'Postgres (database).',
      'anon.',
      'Connection API to Postgres: queries.',
      'Connection between API and anon, both ways.',
      'Connection anon to Postgres.',
      'Connection API connected to VPC.',
      'Note: TODO. add cache.',
    ])
  })
})

describe('connections and order', () => {
  const scene = buildScene(pageView(doc()), 'iso')
  const { items } = describeScene(scene)

  it('lists each node’s wires from its own side', () => {
    expect(items.get('api')?.connections).toBe('Connections: to Postgres (queries); with anon, both ways; with VPC.')
    expect(items.get('db')?.connections).toBe('Connections: from API (queries); from anon.')
    expect(items.get('anon')?.connections).toBe('Connections: with API, both ways; to Postgres.')
    expect(items.get('vpc')?.connections).toBe('Connections: with API.')
  })

  it('joins text and connections into one label', () => {
    expect(a11yLabel(items.get('db')!)).toBe('Postgres (database). Connections: from API (queries); from anon.')
    expect(a11yLabel(items.get('e1')!)).toBe('Connection API to Postgres: queries')
  })

  it('orders zones, nodes, connections, then text', () => {
    expect(a11yOrder(scene)).toEqual(['vpc', 'api', 'db', 'anon', 'e1', 'e2', 'e3', 'e4', 'n1'])
  })
})

describe('describeChanges', () => {
  const item = (text: string) => ({ role: 'node' as const, text })
  const before = new Map([
    ['a', item('API')],
    ['b', item('Postgres')],
  ])

  it('reports added, changed and deleted items', () => {
    const after = new Map([
      ['a', item('Gateway')],
      ['c', item('Queue')],
    ])
    expect(describeChanges(before, after)).toBe('Changed: Gateway. Added Queue. Deleted Postgres')
  })

  it('says nothing when only positions changed', () => {
    expect(describeChanges(before, new Map(before))).toBe('')
  })

  it('counts what goes past the limit', () => {
    const after = new Map(['w', 'x', 'y', 'z'].map((id) => [id, item(id)]))
    expect(describeChanges(new Map(), after, 2)).toBe('Added w. Added x. And 2 more changes')
  })
})
