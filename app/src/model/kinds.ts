import type { AnyEntity } from './entities'
import type { EntityKind } from './schema'

/** How each kind of item is named in the interface. */
export const KIND_META: Record<EntityKind, { label: string; tab: string; one: string; plural: string }> = {
  node: { label: 'Node', tab: 'Nodes', one: 'node', plural: 'nodes' },
  zone: { label: 'Zone', tab: 'Zones', one: 'zone', plural: 'zones' },
  edge: { label: 'Connection', tab: 'Connections', one: 'connection', plural: 'connections' },
  text: { label: 'Text', tab: 'Text & notes', one: 'text item', plural: 'text items' },
}

export const ENTITY_KINDS = Object.keys(KIND_META) as EntityKind[]

/** Panel title for one item: sticky notes are called notes. */
export const entityLabel = (ent: AnyEntity) => (ent.kind === 'text' && ent.item.kind === 'note' ? 'Note' : KIND_META[ent.kind].label)
