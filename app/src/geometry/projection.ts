/** Pixels per world grid unit. */
export const TILE = 40

export type Projection = 'iso' | '2d'
export interface Vec2 {
  x: number
  y: number
}
export interface Vec3 extends Vec2 {
  z: number
}

export const COS30 = Math.cos(Math.PI / 6)
export const SIN30 = 0.5

/** A 2×2 linear map, SVG order: x' = a·x + c·y, y' = b·x + d·y */
export interface Mat2 {
  a: number
  b: number
  c: number
  d: number
}

/** Ground plane (world x/y in px) → screen. */
export function groundMatrix(p: Projection): Mat2 {
  return p === 'iso' ? { a: COS30, b: SIN30, c: -COS30, d: SIN30 } : { a: 1, b: 0, c: 0, d: 1 }
}

/** World point (grid units) → scene px. */
export function project(x: number, y: number, z: number, p: Projection): Vec2 {
  if (p === 'iso') {
    return { x: (x - y) * COS30 * TILE, y: ((x + y) * SIN30 - z) * TILE }
  }
  return { x: x * TILE, y: y * TILE }
}

export const projectV = (v: Vec3, p: Projection) => project(v.x, v.y, v.z, p)

/** Scene px → world point on the ground plane (z = 0). */
export function unproject(sx: number, sy: number, p: Projection): Vec2 {
  if (p === 'iso') {
    const a = sx / (COS30 * TILE) // x - y
    const b = sy / (SIN30 * TILE) // x + y
    return { x: (a + b) / 2, y: (b - a) / 2 }
  }
  return { x: sx / TILE, y: sy / TILE }
}

export function applyMat(m: Mat2, v: Vec2): Vec2 {
  return { x: m.a * v.x + m.c * v.y, y: m.b * v.x + m.d * v.y }
}

export function invertMat(m: Mat2): Mat2 {
  const det = m.a * m.d - m.b * m.c
  return { a: m.d / det, b: -m.b / det, c: -m.c / det, d: m.a / det }
}

export function matrixAttr(m: Mat2, tx = 0, ty = 0): string {
  const r = (n: number) => Math.round(n * 1e5) / 1e5
  return `matrix(${r(m.a)} ${r(m.b)} ${r(m.c)} ${r(m.d)} ${r(tx)} ${r(ty)})`
}

export const snap = (v: number, step: number) => Math.round(v / step) * step
