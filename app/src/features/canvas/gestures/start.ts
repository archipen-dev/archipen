/*
 * Pointer down on the canvas: decide what the press does from the tool, the mode and what is under the pointer.
 * Returns the drag to follow, or null when the press is a one-off (placing a node, toggling selection).
 */
import { duplicate } from '../../../commands/clipboard'
import { addNode, addText } from '../../../commands/create'
import { history } from '../../../commands/mutate'
import { snap } from '../../../geometry/projection'
import { movableSet } from '../../../model/ops'
import { lockedIds } from '../../../model/visibility'
import { getPage } from '../../../store/selectors'
import { useUi } from '../../../store/uiStore'
import { hitAt, isConnectable, type Hit } from '../hitTest'
import { connectGesture, reconnectGesture } from './connect'
import { drawZoneGesture } from './drawZone'
import { bendGesture, heightGesture, resizeGesture, waypointGesture } from './handles'
import { marqueeGesture } from './marquee'
import { moveGesture } from './move'
import { panGesture } from './pan'
import type { Gesture, PointerPoint } from './types'

export interface PressInfo {
  button: number
}

export function startGesture(p: PointerPoint, press: PressInfo): Gesture | null {
  const ui = useUi.getState()
  const hit = hitAt(p.clientX, p.clientY)

  if (press.button === 1 || ui.spaceDown || ui.tool === 'hand') return panGesture(p, null)
  if (ui.mode === 'view') return panGesture(p, hit?.type === 'item' ? hit.id : null)

  switch (ui.tool) {
    case 'node': {
      ui.select([addNode(snap(p.world.x, 1), snap(p.world.y, 1))])
      ui.setTool('select')
      return null
    }
    case 'text':
    case 'note': {
      const step = ui.tool === 'note' ? 1 : 0.5
      const id = addText(snap(p.world.x, step), snap(p.world.y, step), ui.tool)
      ui.select([id])
      ui.setTool('select')
      ui.setEditing(id)
      return null
    }
    case 'zone':
      return drawZoneGesture(p)
    case 'connect':
      return isConnectable(hit) ? connectGesture(hit.id) : null
  }

  if (hit?.type === 'handle') return startHandleDrag(p, hit)
  if (hit) return startItemPress(p, hit)
  if (!p.shift) ui.select([])
  return marqueeGesture(p, { base: p.shift ? ui.selection : [], clickId: null })
}

function startHandleDrag(p: PointerPoint, hit: Extract<Hit, { type: 'handle' }>): Gesture | null {
  const doc = getPage()!
  switch (hit.handle) {
    case 'port':
      return connectGesture(hit.id)
    case 'resize': {
      const item = doc.nodes.find((n) => n.id === hit.id) ?? doc.zones.find((z) => z.id === hit.id) ?? doc.texts.find((t) => t.id === hit.id)
      return item ? resizeGesture(p, hit.id, { w: item.w, d: item.d }) : null
    }
    case 'height': {
      const n = doc.nodes.find((x) => x.id === hit.id)
      return n ? heightGesture(p, hit.id, n.h) : null
    }
    case 'waypoint':
      return waypointGesture(hit.id, Math.max(0, hit.index))
    case 'end':
      return reconnectGesture(hit.id, hit.index === 0 ? 'from' : 'to')
  }
}

function startItemPress(p: PointerPoint, hit: Extract<Hit, { type: 'item' }>): Gesture | null {
  const ui = useUi.getState()
  const selected = ui.selection.includes(hit.id)

  // A zone's body is mostly empty floor: pressing it starts a marquee; a click without a drag selects the zone.
  if (hit.kind === 'zone' && !hit.label && !selected && !p.shift) {
    ui.select([])
    return marqueeGesture(p, { base: [], clickId: hit.id })
  }

  if (p.shift && selected) {
    ui.select(ui.selection.filter((x) => x !== hit.id))
    return null
  }
  let ids = p.shift ? [...ui.selection, hit.id] : selected ? ui.selection : [hit.id]
  ui.select(ids)

  if (p.alt) {
    // Alt-drag duplicates, like Figma. The copy and the move are one undo step.
    history.begin()
    ids = duplicate(ids)
    ui.select(ids)
  }
  // Locked items get selected but stay put.
  const base = getPage()!
  const locked = lockedIds(base)
  // A straight wire has no bends to move: dragging its line bends it instead.
  if (hit.kind === 'edge' && !hit.label && !p.shift && !p.alt && ids.length === 1 && !locked.has(hit.id) && base.edges.find((e) => e.id === hit.id)?.waypoints.length === 0)
    return bendGesture(p, hit.id)
  return moveGesture(p, {
    ids: movableSet(
      base,
      ids.filter((id) => !locked.has(id)),
    ),
    base,
    clickId: hit.id,
  })
}
