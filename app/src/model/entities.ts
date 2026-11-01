/*
 * Looking up and mutating items by id, whatever their kind.
 */
import type { Draft } from 'immer'
import { endId, type Doc, type EdgeData, type EntityKind, type Endpoint, type Layer, type NodeData, type TextData, type ZoneData } from './schema'

export type AnyEntity =
  | { kind: 'node'; item: NodeData }
  | { kind: 'zone'; item: ZoneData }
  | { kind: 'edge'; item: EdgeData }
  | { kind: 'text'; item: TextData }

type AnyItem = NodeData | ZoneData | EdgeData | TextData

const KIND_ORDER: EntityKind[] = ['node', 'zone', 'edge', 'text']

/** The list holding items of `kind`. */
export function itemsOf(doc: Layer, kind: 'node'): NodeData[]
export function itemsOf(doc: Layer, kind: 'zone'): ZoneData[]
export function itemsOf(doc: Layer, kind: 'edge'): EdgeData[]
export function itemsOf(doc: Layer, kind: 'text'): TextData[]
export function itemsOf(doc: Layer, kind: EntityKind): AnyItem[]
export function itemsOf(doc: Layer, kind: EntityKind): AnyItem[] {
  switch (kind) {
    case 'node':
      return doc.nodes
    case 'zone':
      return doc.zones
    case 'edge':
      return doc.edges
    case 'text':
      return doc.texts
  }
}

/** A whole diagram stands for all its pages; anything else is one page. */
const layersOf = (doc: Layer | Doc): readonly Layer[] => ('pages' in doc ? doc.pages : [doc])

/** Find an item by id: on one page, or on any page of a whole diagram. */
export function findEntity(doc: Layer | Doc, id: string): AnyEntity | null {
  for (const layer of layersOf(doc))
    for (const kind of KIND_ORDER) {
      const item = itemsOf(layer, kind).find((x) => x.id === id)
      if (item) return { kind, item } as AnyEntity
    }
  return null
}

export const findEntities = (doc: Layer | Doc, ids: string[]): AnyEntity[] =>
  ids.map((id) => findEntity(doc, id)).filter((e): e is AnyEntity => e !== null)

/** Mutate any entity by id inside a draft (of one page, or of the whole diagram). */
export function withEntity(d: Draft<Doc> | Draft<Layer>, id: string, fn: (item: Draft<AnyItem>, kind: EntityKind) => void) {
  for (const layer of layersOf(d as Layer | Doc))
    for (const kind of KIND_ORDER) {
      const item = (itemsOf(layer, kind) as Draft<AnyItem>[]).find((x) => x.id === id)
      if (item) return fn(item, kind)
    }
}

/** A node or zone: the things wires connect to. */
export const findBox = (doc: Pick<Layer, 'nodes' | 'zones'>, id: string): NodeData | ZoneData | undefined =>
  doc.nodes.find((n) => n.id === id) ?? doc.zones.find((z) => z.id === id)

export const isZone = (doc: Pick<Layer, 'zones'>, id: string) => doc.zones.some((z) => z.id === id)

/** Wire end for a node or zone id. */
export const endpointFor = (doc: Pick<Layer, 'zones'>, id: string): Endpoint => (isZone(doc, id) ? { zoneId: id } : { nodeId: id })

/** Wires that start (`out`) or end (`in`) at `id`. */
export function wiresOf(doc: Pick<Layer, 'edges'>, id: string) {
  return { out: doc.edges.filter((e) => endId(e.from) === id), in: doc.edges.filter((e) => endId(e.to) === id) }
}

export const displayName = (doc: Layer | Doc, id: string) => findEntity(doc, id)?.item.name || 'Untitled'
