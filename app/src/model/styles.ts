/*
 * Per-item style overrides: which keys an item may set to differ from the diagram defaults.
 */
import { EDGE_STYLE_KEYS, NODE_STYLE_KEYS, ZONE_STYLE_KEYS, type EntityKind } from './schema'

export const STYLE_KEYS: Record<EntityKind, readonly string[]> = {
  node: NODE_STYLE_KEYS,
  zone: ZONE_STYLE_KEYS,
  edge: EDGE_STYLE_KEYS,
  text: ['color'],
}

/** Edge look keys, without flow (which has its own section). */
export const EDGE_LOOK_KEYS = EDGE_STYLE_KEYS.filter((k) => k !== 'flow')

/** How many of `keys` the item sets itself. */
export const customCount = (item: object, keys: readonly string[]) => keys.filter((k) => (item as Record<string, unknown>)[k] !== undefined).length

/** Whether the item overrides any style or label default. A note's empty colour means "default". */
export function hasOverrides(item: object, kind: EntityKind): boolean {
  const it = item as Record<string, unknown>
  if (it.label !== undefined) return true
  if (kind === 'text') return it.color !== undefined && !(it.kind === 'note' && it.color === '')
  return customCount(item, STYLE_KEYS[kind]) > 0
}
