import type { Vec2 } from '../../geometry/projection'
import { round as f } from '../../geometry/shapes'
import type { CanvasTheme } from '../theme'

const R = 8

/** The corner of an outline furthest up and to the right on screen. */
const corner = (pts: Vec2[]) => pts.reduce((best, q) => (q.x - q.y > best.x - best.y ? q : best), pts[0])

/**
 * A small "opens another page" mark on the top-right corner of a linked node or zone.
 * Decorative: the item's description already says where the link goes.
 */
export function LinkBadge({ outline, theme }: { outline: Vec2[]; theme: CanvasTheme }) {
  if (!outline.length) return null
  const c = corner(outline)
  const x = c.x - 2
  const y = c.y + 2
  return (
    <g aria-hidden="true" className="ap-link-badge">
      <circle cx={f(x)} cy={f(y)} r={R} fill={theme.bg} stroke={theme.accent} strokeWidth={1.5} />
      <path
        d={`M${f(x - 2.6)} ${f(y + 2.6)} L${f(x + 2.6)} ${f(y - 2.6)} M${f(x - 1.2)} ${f(y - 2.6)} L${f(x + 2.6)} ${f(y - 2.6)} L${f(x + 2.6)} ${f(y + 1.2)}`}
        fill="none"
        stroke={theme.accent}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}
