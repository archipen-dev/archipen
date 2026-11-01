import type { LabelStyle } from '../model/schema'
import { orientationMatrix } from './planes'
import { applyMat, invertMat, type Mat2, type Projection, type Vec2 } from './projection'

export interface LabelLine {
  text: string
  x: number
  y: number
  size: number
  weight: number
  muted: boolean
}

export interface LabelLayout {
  matrix: Mat2
  anchor: 'start' | 'middle' | 'end'
  lines: LabelLine[]
  /** Approximate local-frame box, for selection outlines and bounds. */
  box: { x: number; y: number; w: number; h: number }
}

/** Rough text width; good enough for bounds and hit boxes. */
export const textWidth = (s: string, size: number) => s.length * size * 0.56

export function wrap(text: string, max = 38): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      if (line && (line + ' ' + word).length > max) {
        out.push(line)
        line = word
      } else line = line ? line + ' ' + word : word
    }
    out.push(line)
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out
}

/**
 * Lay out a label around an item.
 * @param outline screen-space points of the item's outline (a single point for edges)
 * @param centerPt screen-space point used for side = 'center' (defaults to outline centre)
 */
export function layoutLabel(
  style: LabelStyle,
  name: string,
  description: string,
  outline: Vec2[],
  p: Projection,
  centerPt?: Vec2,
  /** Wrap text to this width (px), e.g. to fit inside a sticky note. */
  maxWidth?: number,
): LabelLayout | null {
  if (style.hidden) return null
  const ds0 = Math.max(8, style.fontSize * 0.82)
  const chars = (size: number, fallback: number) => (maxWidth ? Math.max(6, Math.floor(maxWidth / (size * 0.56))) : fallback)
  const nameLines = name ? wrap(name, chars(style.fontSize, 40)) : []
  const descLines = style.showDescription && description ? wrap(description, chars(ds0, 38)) : []
  if (nameLines.length + descLines.length === 0) return null

  const m = orientationMatrix(style.orientation, p)
  const inv = invertMat(m)
  const local = outline.map((q) => applyMat(inv, q))
  let u0 = Infinity,
    u1 = -Infinity,
    v0 = Infinity,
    v1 = -Infinity
  for (const q of local) {
    u0 = Math.min(u0, q.x)
    u1 = Math.max(u1, q.x)
    v0 = Math.min(v0, q.y)
    v1 = Math.max(v1, q.y)
  }
  const fs = style.fontSize
  const ds = Math.max(8, fs * 0.82)
  const rows = [
    ...nameLines.map((text) => ({ text, size: fs, weight: 600, muted: false, lh: fs * 1.25 })),
    ...descLines.map((text) => ({ text, size: ds, weight: 400, muted: true, lh: ds * 1.35 })),
  ]
  const blockH = rows.reduce((s, r) => s + r.lh, 0)
  const blockW = Math.max(...rows.map((r) => textWidth(r.text, r.size)))
  const off = style.offset
  const inside = style.inside
  const um = (u0 + u1) / 2
  const vm = (v0 + v1) / 2

  let ax = um
  let top = vm - blockH / 2
  let anchor: LabelLayout['anchor'] = 'middle'

  const alongU = () => {
    if (style.align === 'start') {
      ax = inside ? u0 + off : u0
      anchor = 'start'
    } else if (style.align === 'end') {
      ax = inside ? u1 - off : u1
      anchor = 'end'
    } else {
      ax = um
      anchor = 'middle'
    }
  }
  const alongV = () => {
    if (style.align === 'start') top = inside ? v0 + off : v0
    else if (style.align === 'end') top = (inside ? v1 - off : v1) - blockH
    else top = vm - blockH / 2
  }

  switch (style.side) {
    case 'top':
      alongU()
      top = inside ? v0 + off : v0 - off - blockH
      break
    case 'bottom':
      alongU()
      top = inside ? v1 - off - blockH : v1 + off
      break
    case 'left':
      alongV()
      if (inside) {
        ax = u0 + off
        anchor = 'start'
      } else {
        ax = u0 - off
        anchor = 'end'
      }
      break
    case 'right':
      alongV()
      if (inside) {
        ax = u1 - off
        anchor = 'end'
      } else {
        ax = u1 + off
        anchor = 'start'
      }
      break
    case 'center': {
      const c = centerPt ? applyMat(inv, centerPt) : { x: um, y: vm }
      top = c.y - blockH / 2
      if (style.align === 'start') {
        ax = Math.min(c.x, u0 + off)
        anchor = 'start'
      } else if (style.align === 'end') {
        ax = Math.max(c.x, u1 - off)
        anchor = 'end'
      } else {
        ax = c.x
        anchor = 'middle'
      }
      break
    }
  }

  const lines: LabelLine[] = []
  let y = top
  for (const r of rows) {
    lines.push({ text: r.text, x: ax, y: y + (r.lh - r.size) / 2 + r.size * 0.8, size: r.size, weight: r.weight, muted: r.muted })
    y += r.lh
  }
  const bx = anchor === 'start' ? ax : anchor === 'end' ? ax - blockW : ax - blockW / 2
  return { matrix: m, anchor, lines, box: { x: bx, y: top, w: blockW, h: blockH } }
}

/** Screen-space corners of a layout's local box. */
export function labelCorners(l: LabelLayout): Vec2[] {
  const { x, y, w, h } = l.box
  return [
    { x, y },
    { x: x + w, y },
    { x: x + w, y: y + h },
    { x, y: y + h },
  ].map((q) => applyMat(l.matrix, q))
}
