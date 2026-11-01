import { matrixAttr, type Mat2, type Vec2 } from '../../geometry/projection'
import { round as f } from '../../geometry/shapes'
import type { IconMarkup } from '../../icons/markup'
import { useDecorative } from '../mode'

/** An icon at `at`, `size` px across, transformed by `m` (flat on a face, upright, …). */
export function IconGlyph({ icon, size, color, m, at }: { icon: IconMarkup; size: number; color: string; m: Mat2; at: Vec2 }) {
  const [vx, vy, vw, vh] = icon.viewBox
  const k = size / Math.max(vw, vh)
  const hidden = useDecorative()
  const inner = `translate(${f(-(vw * k) / 2)} ${f(-(vh * k) / 2)}) scale(${f(k * 1000) / 1000}) translate(${-vx} ${-vy})`
  return (
    <g transform={matrixAttr(m, at.x, at.y)} {...hidden}>
      {icon.style === 'stroke' ? (
        <g transform={inner} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon.body }} />
      ) : icon.style === 'fill' ? (
        <g transform={inner} fill={color} dangerouslySetInnerHTML={{ __html: icon.body }} />
      ) : (
        <g transform={inner} dangerouslySetInnerHTML={{ __html: icon.body }} />
      )}
    </g>
  )
}

