/*
 * What is under the pointer, read from the DOM: scene items carry data-id/data-kind,
 * editor handles carry data-handle (see render/parts and Overlay).
 */

export type HandleKind = 'resize' | 'height' | 'waypoint' | 'port' | 'end'

export type Hit =
  | { type: 'item'; id: string; kind: string; /** On the item's label rather than its body. */ label: boolean }
  | { type: 'handle'; id: string; handle: HandleKind; index: number }

export function hitAt(clientX: number, clientY: number): Hit | null {
  for (const el of document.elementsFromPoint(clientX, clientY)) {
    if (!(el instanceof SVGElement || el instanceof HTMLElement)) continue
    const handle = el.closest('[data-handle]')
    if (handle) {
      return {
        type: 'handle',
        id: handle.getAttribute('data-id')!,
        handle: handle.getAttribute('data-handle') as HandleKind,
        index: Number(handle.getAttribute('data-index') ?? -1),
      }
    }
    const ent = el.closest('[data-id]')
    if (ent && ent.closest('.ap-scene')) return { type: 'item', id: ent.getAttribute('data-id')!, kind: ent.getAttribute('data-kind')!, label: !!el.closest('[data-label]') }
    if (el.closest('[data-canvas]')) return null
  }
  return null
}

/** Something a wire can start or end at: a node, a zone, or a node's port dot. */
export const isConnectable = (hit: Hit | null): hit is Hit =>
  !!hit && (hit.type === 'handle' ? hit.handle === 'port' : hit.kind === 'node' || hit.kind === 'zone')
