import { buildScene } from '../geometry/scene'
import { hiddenIds, lockedIds } from '../model/visibility'
import { a11yOrder } from '../render/describe'
import { getPage } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { revealIds } from './view'

/** Select everything except locked and hidden items. */
export function selectAll() {
  const doc = getPage()
  if (!doc) return
  const skip = new Set([...lockedIds(doc), ...hiddenIds(doc)])
  useUi.getState().select([...doc.zones, ...doc.nodes, ...doc.texts, ...doc.edges].map((x) => x.id).filter((id) => !skip.has(id)))
}

export const select = (ids: string[]) => useUi.getState().select(ids)
export const clearSelection = () => useUi.getState().select([])

/** The id after (or before) `current` in `order`; none selected starts at an end. Null past either end. */
export function stepThrough(order: string[], current: string | undefined, dir: 1 | -1): string | null {
  const i = current === undefined ? -1 : order.indexOf(current)
  const next = i < 0 ? (dir === 1 ? 0 : order.length - 1) : i + dir
  return order[next] ?? null
}

/**
 * Keyboard navigation: select the next or previous item in reading order and bring it on screen.
 * Locked items are skipped while editing, as on the canvas. Returns false past the last item, after clearing the selection.
 */
export function selectNext(dir: 1 | -1): boolean {
  const doc = getPage()
  if (!doc) return false
  const ui = useUi.getState()
  const locked = ui.mode === 'edit' ? lockedIds(doc) : new Set<string>()
  const order = a11yOrder(buildScene(doc, doc.settings.projection)).filter((id) => !locked.has(id))
  const current = ui.selection.length === 1 ? ui.selection[0] : undefined
  const next = stepThrough(order, current, dir)
  ui.select(next ? [next] : [])
  if (next) revealIds([next])
  return !!next
}
