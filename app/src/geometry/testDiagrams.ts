/**
 * Generated diagrams for routing tests and benchmarks: `n` blocks on a grid, 1.5 wires per block.
 * "neighbours": wires go to the next block or the one below, like most real diagrams.
 * "long": wires jump across the grid, the worst case for routing.
 */
export function gridDiagram(n: number, wires: 'neighbours' | 'long') {
  const side = Math.ceil(Math.sqrt(n))
  const nodes = Array.from({ length: n }, (_, i) => ({ id: `n${i}`, x: (i % side) * 4, y: Math.floor(i / side) * 4 }))
  const edges = Array.from({ length: Math.round(n * 1.5) }, (_, i) => {
    const to = wires === 'long' ? (i * 7 + 3) % n : (i % n) + (i % 2 ? side : 1)
    return { id: `e${i}`, from: { nodeId: `n${i % n}` }, to: { nodeId: `n${to % n}` } }
  })
  return { format: 'archipen', name: `Grid ${n} (${wires})`, pages: [{ id: 'p', nodes, edges }] }
}
