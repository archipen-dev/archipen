import type { LabelStyle } from '../model/schema'
import { COS30, SIN30, type Mat2, type Projection } from './projection'

export type Orientation = LabelStyle['orientation']

/**
 * Local text/icon frame for each orientation. Local x reads left→right,
 * local y points "down" in the text. All matrices are non-mirroring.
 *
 * Iso:
 *  - ground-x: lies on the floor, reads along +x (towards bottom-right)
 *  - ground-y: lies on the floor, reads along −y (towards top-right)
 *  - wall-x:   stands upright in an x/z plane (parallel to a block's left face)
 *  - wall-y:   stands upright in a y/z plane (parallel to a block's right face)
 * 2D: x-variants are horizontal, y-variants are rotated to read bottom→top.
 */
export function orientationMatrix(o: Orientation, p: Projection): Mat2 {
  if (o === 'screen') return { a: 1, b: 0, c: 0, d: 1 }
  if (p === '2d') {
    return o === 'ground-x' || o === 'wall-x' ? { a: 1, b: 0, c: 0, d: 1 } : { a: 0, b: -1, c: 1, d: 0 }
  }
  switch (o) {
    case 'ground-x':
      return { a: COS30, b: SIN30, c: -COS30, d: SIN30 }
    case 'ground-y':
      return { a: COS30, b: -SIN30, c: COS30, d: SIN30 }
    case 'wall-x':
      return { a: COS30, b: SIN30, c: 0, d: 1 }
    case 'wall-y':
      return { a: COS30, b: -SIN30, c: 0, d: 1 }
  }
}
