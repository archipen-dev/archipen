import { Ban } from 'lucide-react'
import type { IconMarkup } from '../../icons/markup'
import { cx } from '../../lib/cx'
import { luminance } from '../../render/theme'

/** An icon drawn for the interface (not the diagram): stroke icons in the text colour, logos in brand colour. */
export function IconPreview({ icon, size = 18, className }: { icon: IconMarkup | null; size?: number; className?: string }) {
  if (!icon) return <Ban className={cx('text-ink-faint', className)} style={{ width: size * 0.8, height: size * 0.8 }} />
  const [x, y, w, h] = icon.viewBox
  return (
    <svg width={size} height={size} viewBox={`${x} ${y} ${w} ${h}`} className={className}>
      {icon.style === 'stroke' ? (
        <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" dangerouslySetInnerHTML={{ __html: icon.body }} />
      ) : icon.style === 'fill' ? (
        // Near-black logos would vanish on the dark panel; draw those in the text colour.
        <g fill={icon.brandColor && luminance(icon.brandColor) > 0.03 ? icon.brandColor : 'currentColor'} dangerouslySetInnerHTML={{ __html: icon.body }} />
      ) : (
        <g dangerouslySetInnerHTML={{ __html: icon.body }} />
      )}
    </svg>
  )
}
