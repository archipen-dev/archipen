import { memo } from 'react'
import type { SceneZone } from '../../geometry/scene'
import { shade, toPoints } from '../../geometry/shapes'
import { A11yTitle, LinkWrap, useTag } from '../mode'
import { mix, type CanvasTheme } from '../theme'
import { LinkBadge } from './LinkBadge'

/** A zone: tinted floor, dashed or solid border, and a thin slab under it in iso. */
export const ZoneShape = memo(function ZoneShape({ sz, theme }: { sz: SceneZone; theme: CanvasTheme }) {
  const z = sz.zone
  const tag = useTag(z.id, 'zone')
  const tint = Math.min(theme.zoneTint * z.fill, 0.9)
  const fill = mix(theme.bg, z.color, tint)
  const stroke = mix(theme.bg, z.color, theme.name === 'dark' ? 0.75 : 0.65)
  return (
    <LinkWrap id={z.id}>
      <g {...tag}>
        <A11yTitle id={z.id} />
        {sz.slab && (
          <>
            <polygon points={toPoints(sz.slab.left)} fill={mix(theme.bg, z.color, Math.min(tint * 2.6, 1))} />
            <polygon points={toPoints(sz.slab.right)} fill={mix(theme.bg, z.color, Math.min(tint * 3.6, 1))} />
          </>
        )}
        <polygon
          points={toPoints(sz.poly)}
          fill={fill}
          stroke={stroke}
          strokeWidth={z.border}
          strokeDasharray={z.dashed ? `${4 + z.border * 1.4} ${3.5 + z.border}` : undefined}
          strokeLinejoin="round"
        />
        {z.link && <LinkBadge outline={sz.poly} theme={theme} />}
      </g>
    </LinkWrap>
  )
})

export const zoneInk = (color: string, theme: CanvasTheme) => (theme.name === 'dark' ? mix(color, '#ffffff', 0.35) : shade(color, -0.35))
