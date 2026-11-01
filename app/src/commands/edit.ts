/*
 * Changes to a set of items: delete, move, arrange, lock and hide, recolour.
 */
import { arrangeDeltas, arrangeRoots, type ArrangeOp } from '../model/arrange'
import { findEntities, withEntity } from '../model/entities'
import { recomputeMembership } from '../model/membership'
import { applyMove, movableSet, removeItems } from '../model/ops'
import { lockedIds } from '../model/visibility'
import { getDoc, getPage } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { mutate, mutatePage } from './mutate'

export function deleteIds(ids: string[]) {
  if (!ids.length) return
  mutatePage((d) => {
    removeItems(d, new Set(ids))
    recomputeMembership(d)
  })
  useUi.getState().select([])
}

/** Move by a world delta. Locked items stay put; zones bring their contents. */
export function nudge(ids: string[], dx: number, dy: number) {
  const base = getPage()
  if (!base || !ids.length) return
  const locked = lockedIds(base)
  const set = movableSet(base, ids.filter((id) => !locked.has(id)))
  if (!set.size) return
  mutatePage((d) => {
    applyMove(d, base, set, dx, dy)
    recomputeMembership(d)
  })
}

/** Align or distribute. */
export function arrange(ids: string[], op: ArrangeOp) {
  const base = getPage()
  if (!base) return
  const locked = lockedIds(base)
  const deltas = arrangeDeltas(arrangeRoots(base, ids.filter((id) => !locked.has(id))), op)
  if (!deltas.size) return
  mutatePage((d) => {
    for (const [id, { dx, dy }] of deltas) applyMove(d, base, movableSet(base, [id]), dx, dy)
    recomputeMembership(d)
  })
}

/** Give every selected node the width and depth of the first selected node. */
export function matchNodeSize(ids: string[]) {
  const doc = getPage()
  const ref = ids.map((id) => doc?.nodes.find((n) => n.id === id)).find(Boolean)
  if (!ref) return
  const locked = lockedIds(doc!)
  const set = new Set(ids.filter((id) => !locked.has(id)))
  mutatePage((d) => {
    for (const n of d.nodes) if (set.has(n.id)) ((n.w = ref.w), (n.d = ref.d))
    recomputeMembership(d)
  })
}

export type Flag = 'locked' | 'hidden'

/** Whether every one of `ids` has the flag. */
export function allFlagged(ids: string[], flag: Flag) {
  const doc = getDoc()
  const items = doc ? findEntities(doc, ids) : []
  return items.length > 0 && items.every((e) => e.item[flag])
}

/** Lock or hide `ids`; if they all have the flag already, clear it instead. */
export function toggleFlag(ids: string[], flag: Flag, on?: boolean) {
  if (!getDoc() || !ids.length) return
  const value = on ?? !allFlagged(ids, flag)
  mutate((d) => {
    for (const id of ids)
      withEntity(d, id, (it) => {
        if (value) it[flag] = true
        else delete it[flag]
      })
  })
}

/** Recolour nodes, zones and wires (text has its own palettes). */
export const setColor = (ids: string[], color: string) =>
  mutate((d) => {
    for (const id of ids) withEntity(d, id, (item, kind) => kind !== 'text' && ((item as { color?: string }).color = color))
  })
