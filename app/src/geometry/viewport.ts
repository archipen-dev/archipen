/*
 * Pan and zoom math for the canvas. `Viewport` maps scene px to screen px: screen = scene * zoom + (x, y).
 */
import type { Vec2 } from './projection'
import type { Rect } from './shapes'

export interface Viewport {
  x: number
  y: number
  zoom: number
}

export interface Insets {
  left: number
  top: number
  right: number
  bottom: number
}

export const MIN_ZOOM = 0.1
export const MAX_ZOOM = 8

export const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

/** Zoom around a screen point (container-relative px). */
export function zoomAt(v: Viewport, factor: number, sx: number, sy: number): Viewport {
  const zoom = clampZoom(v.zoom * factor)
  const k = zoom / v.zoom
  return { zoom, x: sx - (sx - v.x) * k, y: sy - (sy - v.y) * k }
}

/** Screen (container-relative) to scene coordinates. */
export const screenToScene = (v: Viewport, p: Vec2): Vec2 => ({ x: (p.x - v.x) / v.zoom, y: (p.y - v.y) / v.zoom })

/** The scene area visible in a container of `size`. */
export const visibleRect = (v: Viewport, size: { w: number; h: number }): Rect => ({ x: -v.x / v.zoom, y: -v.y / v.zoom, w: size.w / v.zoom, h: size.h / v.zoom })

/** Viewport that centres `r` in the part of the container not covered by `insets`. */
export function fitViewport(r: Rect, size: { w: number; h: number }, insets: Insets, pad: number, maxZoom: number): Viewport {
  const W = size.w - insets.left - insets.right
  const H = size.h - insets.top - insets.bottom
  const zoom = clampZoom(Math.min((W - pad * 2) / Math.max(r.w, 1), (H - pad * 2) / Math.max(r.h, 1), maxZoom))
  return { zoom, x: insets.left + W / 2 - (r.x + r.w / 2) * zoom, y: insets.top + H / 2 - (r.y + r.h / 2) * zoom }
}
