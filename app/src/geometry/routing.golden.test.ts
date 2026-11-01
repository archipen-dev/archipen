import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { parseDoc, resolveDoc } from '../model/defaults'
import { pageView } from '../model/pages'
import { routeEdges } from './routing'
import { gridDiagram } from './testDiagrams'

/*
 * Wire routes for the examples and two generated diagrams, saved in fixtures/routes.golden.json.
 * Speed-ups to the router must not change where wires go. After an intended change to routing,
 * run `UPDATE_GOLDEN=1 npx vitest run routing.golden` and review the diff.
 */

const repo = (path: string) => fileURLToPath(new URL(`../../../${path}`, import.meta.url))
const GOLDEN = fileURLToPath(new URL('./fixtures/routes.golden.json', import.meta.url))

const round = (n: number) => Math.round(n * 1e6) / 1e6

function routesOf(raw: unknown): Record<string, number[][]> {
  const doc = parseDoc(raw)
  const out: Record<string, number[][]> = {}
  for (const page of doc.pages) {
    const view = resolveDoc(pageView(doc, page.id))
    for (const [id, r] of routeEdges(view.nodes, view.edges, { zones: view.zones })) out[id] = r.points.map((p) => [round(p.x), round(p.y)])
  }
  return out
}

function allRoutes(): Record<string, Record<string, number[][]>> {
  const out: Record<string, Record<string, number[][]>> = {}
  for (const f of readdirSync(repo('examples')).filter((f) => f.endsWith('.json')).sort())
    out[f] = routesOf(JSON.parse(readFileSync(repo(`examples/${f}`), 'utf8')))
  out['grid-150-neighbours'] = routesOf(gridDiagram(150, 'neighbours'))
  out['grid-150-long'] = routesOf(gridDiagram(150, 'long'))
  return out
}

describe('routing output', () => {
  it('matches the saved routes', () => {
    const now = allRoutes()
    if (process.env.UPDATE_GOLDEN || !existsSync(GOLDEN)) writeFileSync(GOLDEN, JSON.stringify(now) + '\n')
    expect(now).toEqual(JSON.parse(readFileSync(GOLDEN, 'utf8')))
  }, 60_000)
})
