import type { Layer } from './schema'

type Box = { x: number; y: number; w: number; d: number }

const contains = (z: Box, px: number, py: number) => px >= z.x && px <= z.x + z.w && py >= z.y && py <= z.y + z.d

/** Set `obj[key]`, or remove the key when there is no value (keeps saved files free of `undefined`). */
function assign<T extends object, K extends keyof T>(obj: T, key: K, value: T[K] | undefined) {
  if (value === undefined) delete obj[key]
  else obj[key] = value
}

/**
 * Recompute which zone every node/text/zone belongs to, from positions alone:
 * a node or note belongs to the innermost zone containing its centre (plain text: its anchor),
 * a zone to the smallest larger zone containing it completely. Mutates `d`.
 */
export function recomputeMembership(d: Pick<Layer, 'nodes' | 'zones' | 'texts'>) {
  const zones = [...d.zones].sort((a, b) => a.w * a.d - b.w * b.d) // smallest first
  for (const n of d.nodes) {
    const z = zones.find((z) => contains(z, n.x + n.w / 2, n.y + n.d / 2))
    assign(n, 'zoneId', z?.id)
  }
  for (const t of d.texts) {
    const px = t.kind === 'note' ? t.x + t.w / 2 : t.x
    const py = t.kind === 'note' ? t.y + t.d / 2 : t.y
    const z = zones.find((z) => contains(z, px, py))
    assign(t, 'zoneId', z?.id)
  }
  for (const zone of d.zones) {
    const parent = zones.find(
      (z) =>
        z.id !== zone.id &&
        z.w * z.d > zone.w * zone.d &&
        contains(z, zone.x, zone.y) &&
        contains(z, zone.x + zone.w, zone.y + zone.d),
    )
    assign(zone, 'parentZoneId', parent?.id)
  }
  // break accidental cycles
  for (const zone of d.zones) {
    const seen = new Set<string>()
    let cur: (typeof d.zones)[number] | undefined = zone
    while (cur?.parentZoneId) {
      if (seen.has(cur.id)) {
        delete zone.parentZoneId
        break
      }
      seen.add(cur.id)
      cur = d.zones.find((z) => z.id === cur!.parentZoneId)
    }
  }
}

/** All zones, nodes and texts that sit inside a zone, recursively. */
export function zoneDescendants(doc: Pick<Layer, 'nodes' | 'zones' | 'texts'>, zoneId: string): Set<string> {
  const out = new Set<string>()
  const walk = (zid: string) => {
    for (const z of doc.zones) if (z.parentZoneId === zid && !out.has(z.id)) (out.add(z.id), walk(z.id))
    for (const n of doc.nodes) if (n.zoneId === zid) out.add(n.id)
    for (const t of doc.texts) if (t.zoneId === zid) out.add(t.id)
  }
  walk(zoneId)
  return out
}
