/*
 * Adding new items. Each returns the new id(s) so the caller can select them.
 */
import { makeEdge, makeNode, makeText, makeZone } from '../model/defaults'
import { endpointFor } from '../model/entities'
import { recomputeMembership } from '../model/membership'
import type { NodeData, TextData } from '../model/schema'
import { getDoc, getPage } from '../store/selectors'
import { mutatePage } from './mutate'

const styles = () => getDoc()!.settings.styles

/** A node of the default size, centred on (x, y). */
export function addNode(x: number, y: number) {
  const s = styles()
  const node = makeNode({ x: x - Math.round(s.node.w / 2), y: y - Math.round(s.node.d / 2) }, s)
  return addNodes([node])[0]
}

/** Add prepared nodes (e.g. dropped icons). */
export function addNodes(nodes: NodeData[]) {
  mutatePage((d) => {
    d.nodes.push(...nodes)
    recomputeMembership(d)
  })
  return nodes.map((n) => n.id)
}

export function addZone(x: number, y: number, w: number, d: number) {
  const zone = makeZone({ x, y, w, d })
  mutatePage((doc) => {
    doc.zones.push(zone)
    recomputeMembership(doc)
  })
  return zone.id
}

/** Plain text anchored at (x, y), or a sticky note centred on it. */
export function addText(x: number, y: number, kind: TextData['kind']) {
  const s = styles()
  const t = makeText(kind === 'note' ? { x: x - s.note.w / 2, y: y - s.note.d / 2, kind } : { x, y, kind }, s)
  mutatePage((d) => {
    d.texts.push(t)
    recomputeMembership(d)
  })
  return t.id
}

/** Connect two nodes or zones. Null when they are the same. */
export function addEdge(from: string, to: string) {
  const doc = getPage()
  if (from === to || !doc) return null
  const e = makeEdge({ from: endpointFor(doc, from), to: endpointFor(doc, to) })
  mutatePage((d) => void d.edges.push(e))
  return e.id
}

/** Nodes showing icons, in a row from (x, y), for dropped or imported SVGs. */
export function addIconNodes(icons: { ref: string; name: string }[], x: number, y: number) {
  const s = styles()
  return addNodes(icons.map(({ ref, name }, i) => makeNode({ x: x - 1 + i * 3, y: y - 1, icon: ref, shape: 'icon', iconPlacement: 'billboard', name }, s)))
}
