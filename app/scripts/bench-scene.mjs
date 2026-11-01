// Time scene builds on generated diagrams: a full build, and one drag frame after a drag started.
// Run with `node app/scripts/bench-scene.mjs`. Not part of CI; use it to check routing and scene changes.
import { load } from './load.mjs'

const { buildScene, createSceneBuilder } = await load('/src/geometry/scene.ts')
const { gridDiagram } = await load('/src/geometry/testDiagrams.ts')
const { parseDoc } = await load('/src/model/defaults.ts')
const { pageView } = await load('/src/model/pages.ts')

/** Median time of `runs` calls, in ms. */
function time(runs, fn) {
  const t = []
  for (let i = 0; i < runs; i++) {
    const s = performance.now()
    fn()
    t.push(performance.now() - s)
  }
  return t.sort((a, b) => a - b)[Math.floor(runs / 2)]
}

/** The same doc with one block moved: a new doc and page object, the rest shared, as Immer would. */
function moved(doc, id, dx) {
  const page = doc.pages[0]
  const nodes = page.nodes.map((n) => (n.id === id ? { ...n, x: n.x + dx } : n))
  return { ...doc, pages: [{ ...page, nodes }] }
}

console.log('blocks  wires        full build   drag frame')
for (const [n, wires] of [
  [150, 'neighbours'],
  [150, 'long'],
  [400, 'neighbours'],
  [400, 'long'],
]) {
  const doc = parseDoc(gridDiagram(n, wires))
  buildScene(pageView(doc), 'iso') // warm up
  const full = time(3, () => buildScene(pageView(doc), 'iso'))

  const builder = createSceneBuilder()
  const id = `n${Math.floor(n / 2)}`
  let frame = doc
  builder.build(pageView(doc), 'iso')
  const drag = time(21, () => {
    frame = moved(frame, id, 0.01)
    builder.build(pageView(frame), 'iso', { incremental: true })
  })
  console.log(`${String(n).padEnd(8)}${wires.padEnd(13)}${full.toFixed(0).padStart(7)} ms${drag.toFixed(1).padStart(10)} ms`)
}
