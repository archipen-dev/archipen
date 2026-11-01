/*
 * Size limits for exports. Shared by the browser export and the headless renderer (render/), which
 * runs on servers: a file with far-away items must not be able to ask for a huge bitmap.
 */

/** Largest exported width or height, in px at scale 1. */
export const MAX_SVG_SIDE = 100_000
/** Largest PNG side, in pixels (also about the largest canvas browsers allow). */
export const MAX_RASTER_SIDE = 16_384
/** Largest PNG area, in pixels. */
export const MAX_RASTER_PIXELS = 64_000_000

/** The diagram is too big to draw. The export server answers 422. */
export class RenderLimitError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RenderLimitError'
  }
}

/** There is nothing to draw: no visible items. Also answered with 422. */
export class EmptyDiagramError extends RenderLimitError {
  constructor(message = 'The diagram is empty') {
    super(message)
    this.name = 'EmptyDiagramError'
  }
}

/** The PNG scale actually used: the requested one, lowered until the image fits both limits. */
export function rasterScale(width: number, height: number, scale: number): number {
  return Math.min(scale, MAX_RASTER_SIDE / Math.max(width, height), Math.sqrt(MAX_RASTER_PIXELS / (width * height)))
}
