/*
 * Camera commands: fit, zoom and pan the canvas.
 */
import { boundsOfIds } from '../geometry/hit'
import { buildScene } from '../geometry/scene'
import type { Rect } from '../geometry/shapes'
import { fitViewport, visibleRect, zoomAt, type Insets } from '../geometry/viewport'
import { getPage } from '../store/selectors'
import { hasSidePanel, useUi } from '../store/uiStore'

/** Canvas area not covered by floating panels. */
function insets(): Insets {
  const ui = useUi.getState()
  if (ui.presenting) return { left: 0, top: 0, right: 0, bottom: 0 }
  return { left: 80, top: 72, right: hasSidePanel(ui) ? 336 : 0, bottom: 64 }
}

export function fitRect(r: Rect | null, maxZoom = 1.5) {
  if (!r) return
  const ui = useUi.getState()
  ui.setViewport(fitViewport(r, ui.canvasSize, insets(), 48, maxZoom))
}

const sceneOf = () => {
  const doc = getPage()
  return doc ? buildScene(doc, doc.settings.projection) : null
}

export const fitAll = () => fitRect(sceneOf()?.bounds ?? null)

export function fitSelection() {
  const { selection } = useUi.getState()
  const scene = sceneOf()
  if (scene && selection.length) fitRect(boundsOfIds(scene, selection), 4)
}

/** Pan, keeping the zoom, so the items are on screen (centred if they weren't). */
export function revealIds(ids: string[]) {
  const scene = sceneOf()
  const r = scene && ids.length ? boundsOfIds(scene, ids) : null
  if (!r) return
  const ui = useUi.getState()
  const { viewport: v, canvasSize: size } = ui
  const ins = insets()
  const view = visibleRect(v, size)
  const k = v.zoom
  const inside = r.x >= view.x + ins.left / k && r.y >= view.y + ins.top / k && r.x + r.w <= view.x + view.w - ins.right / k && r.y + r.h <= view.y + view.h - ins.bottom / k
  if (inside) return
  const cx = (ins.left + size.w - ins.right) / 2
  const cy = (ins.top + size.h - ins.bottom) / 2
  ui.setViewport({ ...v, x: cx - (r.x + r.w / 2) * k, y: cy - (r.y + r.h / 2) * k })
}

/** Zoom around the canvas centre. */
export function zoomBy(factor: number) {
  const ui = useUi.getState()
  ui.setViewport(zoomAt(ui.viewport, factor, ui.canvasSize.w / 2, ui.canvasSize.h / 2))
}

export const zoomTo = (zoom: number) => zoomBy(zoom / useUi.getState().viewport.zoom)

export const ZOOM_STEP = 1.25
export const zoomIn = () => zoomBy(ZOOM_STEP)
export const zoomOut = () => zoomBy(1 / ZOOM_STEP)
