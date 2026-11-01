/*
 * Plain-language descriptions of a diagram, for screen readers. The SVG export puts the summary in the root
 * <desc> and each item's sentence in a <title> on its shape.
 */
import type { Scene } from '../geometry/scene'
import { endId, type Edge } from '../model/schema'
import type { A11yItem } from './mode'

export interface SceneDescription {
  summary: string
  items: Map<string, A11yItem>
}

const clean = (s: string) => s.replace(/\s+/g, ' ').trim()
const withDetail = (head: string, detail: string) => (clean(detail) ? `${head}: ${clean(detail)}` : head)
const count = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

function connection(e: Edge, from: string, to: string): string {
  switch (e.arrows) {
    case 'end':
      return `${from} to ${to}`
    case 'start':
      return `${to} to ${from}`
    case 'both':
      return `between ${from} and ${to}, both ways`
    default:
      return `${from} connected to ${to}`
  }
}

/** How a wire reads from one of its ends: "to B", "from B", or "with B". */
function seenFrom(e: Edge, self: 'from' | 'to', other: string): string {
  const out = (e.arrows === 'end' && self === 'from') || (e.arrows === 'start' && self === 'to')
  const inn = (e.arrows === 'end' && self === 'to') || (e.arrows === 'start' && self === 'from')
  const head = out ? `to ${other}` : inn ? `from ${other}` : e.arrows === 'both' ? `with ${other}, both ways` : `with ${other}`
  return clean(e.name) ? `${head} (${clean(e.name)})` : head
}

/** Item ids in reading order: zones, nodes, connections, then free text. */
export function a11yOrder(scene: Scene): string[] {
  return [...scene.zones.map((z) => z.zone.id), ...scene.nodes.map((n) => n.node.id), ...scene.edges.map((e) => e.edge.id), ...scene.texts.map((t) => t.text.id)]
}

/**
 * Describe what is drawn: hidden items are already left out of the scene.
 * `pageNames` (page id → name) lets linked nodes and zones say where their link goes.
 */
export function describeScene(scene: Scene, pageNames?: ReadonlyMap<string, string>): SceneDescription {
  const names = new Map<string, string>()
  for (const { node } of scene.nodes) names.set(node.id, clean(node.name) || node.id)
  for (const { zone } of scene.zones) names.set(zone.id, clean(zone.name) || zone.id)
  const name = (id: string) => names.get(id) ?? id

  const items = new Map<string, A11yItem>()
  const lines: string[] = []

  for (const { node } of scene.nodes) {
    const head = node.shape === 'cylinder' ? `${name(node.id)} (database)` : name(node.id)
    items.set(node.id, { role: 'node', text: withDetail(head, node.description) })
  }

  // Zones list what sits directly inside them: nodes, notes and nested zones.
  const children = new Map<string, string[]>()
  const addChild = (zoneId: string | undefined, label: string) => {
    if (zoneId && names.has(zoneId)) children.set(zoneId, [...(children.get(zoneId) ?? []), label])
  }
  for (const { zone } of scene.zones) addChild(zone.parentZoneId, `zone ${name(zone.id)}`)
  for (const { node } of scene.nodes) addChild(node.zoneId, name(node.id))
  for (const { text } of scene.texts) if (clean(text.name)) addChild(text.zoneId, `${text.kind === 'note' ? 'note' : 'text'} "${clean(text.name)}"`)
  for (const { zone } of scene.zones) {
    const inside = children.get(zone.id)
    const head = withDetail(`Zone ${name(zone.id)}`, zone.description)
    items.set(zone.id, { role: 'zone', text: inside ? `${head}. Contains ${inside.join(', ')}.` : head })
  }

  // Each node and zone also lists its wires, so focusing one tells where it connects.
  const wires = new Map<string, string[]>()
  const addWire = (id: string, text: string) => wires.set(id, [...(wires.get(id) ?? []), text])
  for (const { edge } of scene.edges) {
    const a = endId(edge.from)
    const b = endId(edge.to)
    addWire(a, seenFrom(edge, 'from', name(b)))
    if (b !== a) addWire(b, seenFrom(edge, 'to', name(a)))
  }
  for (const [id, list] of wires) {
    const item = items.get(id)
    if (item) item.connections = `Connections: ${list.join('; ')}.`
  }

  if (pageNames)
    for (const it of [...scene.nodes.map((n) => n.node), ...scene.zones.map((z) => z.zone)]) {
      const target = it.link && pageNames.get(it.link.page)
      const item = items.get(it.id)
      if (target !== undefined && target !== null && item) item.link = `Details on page ${clean(target) || 'Untitled page'}.`
    }

  for (const { edge } of scene.edges) {
    const head = `Connection ${connection(edge, name(endId(edge.from)), name(endId(edge.to)))}`
    items.set(edge.id, { role: 'connection', text: withDetail(head, [edge.name, edge.description].map(clean).filter(Boolean).join('. ')) })
  }

  for (const { text } of scene.texts) {
    const body = [text.name, text.description].map(clean).filter(Boolean).join('. ')
    if (!body) continue
    items.set(text.id, { role: text.kind === 'note' ? 'note' : 'text', text: text.kind === 'note' ? `Note: ${body}` : body })
  }

  const totals = [
    count(scene.nodes.length, 'node', 'nodes'),
    count(scene.edges.length, 'connection', 'connections'),
    count(scene.zones.length, 'zone', 'zones'),
  ]
  lines.push(`Diagram with ${totals.join(', ')}.`)
  for (const id of a11yOrder(scene)) {
    const item = items.get(id)
    if (item) lines.push(/[.!?]$/.test(item.text) ? item.text : `${item.text}.`)
  }
  return { summary: lines.join('\n'), items }
}

/** The full sentence for an item: its description and, for nodes and zones, its connections and link. */
export function a11yLabel(item: A11yItem): string {
  const extra = [item.connections, item.link].filter(Boolean)
  if (!extra.length) return item.text
  return [/[.!?]$/.test(item.text) ? item.text : `${item.text}.`, ...extra].join(' ')
}

/**
 * What changed between two descriptions of the same document, as short sentences for a live region.
 * At most `limit` lines; the rest are counted.
 */
export function describeChanges(before: Map<string, A11yItem>, after: Map<string, A11yItem>, limit = 3): string {
  const lines: string[] = []
  for (const [id, item] of after) {
    const old = before.get(id)
    if (!old) lines.push(`Added ${item.text}`)
    else if (old.text !== item.text) lines.push(`Changed: ${item.text}`)
  }
  for (const [id, item] of before) if (!after.has(id)) lines.push(`Deleted ${item.text}`)
  if (lines.length <= limit) return lines.join('. ')
  return `${lines.slice(0, limit).join('. ')}. And ${lines.length - limit} more changes`
}
