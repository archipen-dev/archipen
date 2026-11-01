import { groundMatrix, matrixAttr, TILE, type Projection } from '../../geometry/projection'
import type { Rect } from '../../geometry/shapes'

const MIN_ZOOM = 0.3
const MAJOR_EVERY = 5

/** The ground grid, drawn only over the visible area. Fades out when zoomed far out. */
export function Grid({ projection, zoom, visible, color, axis }: { projection: Projection; zoom: number; visible: Rect; color: string; axis: string }) {
  if (zoom < MIN_ZOOM) return null
  const m = groundMatrix(projection)
  const sw = 1 / zoom
  const id = `ap-grid-${projection}`
  const major = TILE * MAJOR_EVERY
  return (
    <g className="ap-grid" aria-hidden="true" style={{ pointerEvents: 'none' }}>
      <defs>
        <pattern id={id} width={TILE} height={TILE} patternUnits="userSpaceOnUse" patternTransform={matrixAttr(m)}>
          <path d={`M${TILE} 0 L0 0 L0 ${TILE}`} fill="none" stroke={color} strokeWidth={sw / Math.min(1, m.b === 0 ? 1 : 0.7)} />
        </pattern>
        <pattern id={`${id}-major`} width={major} height={major} patternUnits="userSpaceOnUse" patternTransform={matrixAttr(m)}>
          <path d={`M${major} 0 L0 0 L0 ${major}`} fill="none" stroke={axis} strokeWidth={sw * 1.2} />
        </pattern>
      </defs>
      <rect x={visible.x} y={visible.y} width={visible.w} height={visible.h} fill={`url(#${id})`} opacity={Math.min(1, (zoom - MIN_ZOOM) * 3)} />
      <rect x={visible.x} y={visible.y} width={visible.w} height={visible.h} fill={`url(#${id}-major)`} />
    </g>
  )
}
