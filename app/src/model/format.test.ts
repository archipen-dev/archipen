import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { emptyDoc, parseDoc, sampleDoc, validateDoc } from './defaults'
import { DOCS_PATH, jsonSchemaText, SCHEMA_PATH, withIconList } from './jsonSchema'
import { skillFiles } from './skill'

/** Paths in the repo root (schema/, examples/, docs/), wherever the tests run from. */
const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url))
const read = (path: string) => JSON.parse(readFileSync(repo(path), 'utf8'))


/** A file with one page. */
const one = (page: object) => ({ format: 'archipen', pages: [{ id: 'p', ...page }] })

describe('file format', () => {
  it('the committed JSON Schema is up to date (run `npm run schema`)', () => {
    expect(readFileSync(repo(SCHEMA_PATH), 'utf8')).toBe(jsonSchemaText())
  })

  it('the icon list in the docs is up to date (run `npm run schema`)', () => {
    const docs = readFileSync(repo(DOCS_PATH), 'utf8')
    expect(docs).toBe(withIconList(docs))
  })

  it('the agent skill in skills/archipen/ is up to date (run `npm run schema`)', () => {
    const text = (path: string) => readFileSync(repo(path), 'utf8')
    for (const [path, expected] of Object.entries(skillFiles(text))) expect(text(path), path).toBe(expected)
  })

  it.each(readdirSync(repo('examples')).filter((f) => f.endsWith('.json')))('examples/%s loads without errors or warnings', (f) => {
    const { doc, issues } = validateDoc(read(`examples/${f}`))
    expect(issues).toEqual([])
    expect(doc).not.toBeNull()
  })

  it('fills in everything a minimal file leaves out', () => {
    const doc = parseDoc({ format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a', x: 1, y: 2 }] }] })
    expect(doc.id).toMatch(/^d/)
    expect(doc.settings).toEqual(emptyDoc().settings)
    expect(doc.pages[0].nodes[0]).toMatchObject({ id: 'a', name: '', w: 2, d: 2, h: 1 })
    expect(doc.pages[0].edges).toEqual([])
  })

  it('refuses files from a newer format version with one clear error', () => {
    const { doc, issues } = validateDoc({ format: 'archipen', version: 2, pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0, shape: 'future-shape' }] }] })
    expect(doc).toBeNull()
    expect(issues).toHaveLength(1)
    expect(issues[0]).toMatchObject({ level: 'error', path: 'version' })
    expect(issues[0].message).toContain('newer Archipen')
  })

  it('accepts version 1 or none, and rejects versions that are not positive integers', () => {
    expect(parseDoc({ format: 'archipen' }).version).toBe(1)
    expect(parseDoc({ format: 'archipen', version: 1 }).version).toBe(1)
    for (const version of [0, 1.5, -1]) expect(validateDoc({ format: 'archipen', version }).doc, String(version)).toBeNull()
  })

  it('merges partial settings over the defaults', () => {
    const doc = parseDoc({ format: 'archipen', settings: { projection: '2d', labelDefaults: { node: { fontSize: 20 } }, styles: { edge: { flow: { speed: 3 } } } } })
    const d = emptyDoc().settings
    expect(doc.settings.projection).toBe('2d')
    expect(doc.settings.labelDefaults.node).toEqual({ ...d.labelDefaults.node, fontSize: 20 })
    expect(doc.settings.styles.edge.flow).toEqual({ ...d.styles.edge.flow, speed: 3 })
  })

  it('derives zone membership from positions', () => {
    const doc = parseDoc(read('examples/web-shop.archipen.json'))
    const page = doc.pages[0]
    const node = (id: string) => page.nodes.find((n) => n.id === id)!
    expect(node('lb').zoneId).toBe('aws')
    expect(node('api').zoneId).toBe('private')
    expect(node('users').zoneId).toBeUndefined()
    expect(page.zones.find((z) => z.id === 'private')!.parentZoneId).toBe('aws')
  })

  it('reports every broken reference at once', () => {
    const { doc, issues } = validateDoc(
      one({
        zones: [{ id: 'z', x: 0, y: 0, w: 4, d: 4 }],
        nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'a', x: 5, y: 0 }],
        edges: [
          { id: 'e1', from: { nodeId: 'a' }, to: { nodeId: 'missing' } },
          { id: 'e2', from: { nodeId: 'z' }, to: { nodeId: 'a' } },
        ],
      }),
    )
    expect(doc).toBeNull()
    expect(issues.filter((i) => i.level === 'error').map((i) => i.path)).toEqual(['pages[0].nodes[1].id', 'pages[0].edges[0].to.nodeId', 'pages[0].edges[1].from.nodeId'])
    expect(() => parseDoc(one({ edges: [{ id: 'e', from: { nodeId: 'x' }, to: { nodeId: 'y' } }] }))).toThrow(/edges\[0\]\.from\.nodeId[\s\S]*edges\[0\]\.to\.nodeId/)
  })

  it('warns about unknown icons and overlapping items but still loads', () => {
    const { doc, issues } = validateDoc(
      one({
        nodes: [{ id: 'a', x: 0, y: 0, icon: 'lucide:not-an-icon' }, { id: 'b', x: 1, y: 1, icon: 'custom:nope' }],
        zones: [{ id: 'z1', x: 0, y: 0, w: 4, d: 4 }, { id: 'z2', x: 2, y: 2, w: 4, d: 4 }],
      }),
    )
    expect(doc).not.toBeNull()
    expect(issues.map((i) => `${i.level} ${i.path}`)).toEqual(['warning pages[0].nodes[0].icon', 'warning pages[0].nodes[1].icon', 'warning pages[0].nodes[1]', 'warning pages[0].zones[1]'])
  })

  it('accepts known vendor icons and warns about unknown ones', () => {
    const { doc, issues } = validateDoc(one({ nodes: [{ id: 'a', x: 0, y: 0, icon: 'vendor:kubernetes' }, { id: 'b', x: 4, y: 0, icon: 'vendor:nope' }] }))
    expect(doc).not.toBeNull()
    expect(issues.map((i) => `${i.level} ${i.path}`)).toEqual(['warning pages[0].nodes[1].icon'])
  })

  it('rejects colours that are not 6-digit hex', () => {
    expect(() => parseDoc(one({ nodes: [{ id: 'a', x: 0, y: 0, color: 'red' }] }))).toThrow(/nodes\[0\]\.color/)
  })

  it('round-trips the sample document unchanged', () => {
    const doc = sampleDoc()
    const once = parseDoc(JSON.parse(JSON.stringify(doc)))
    expect(parseDoc(JSON.parse(JSON.stringify(once)))).toEqual(once)
  })
})
