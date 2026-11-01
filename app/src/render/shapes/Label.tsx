import { memo, useContext } from 'react'
import type { LabelLayout } from '../../geometry/labels'
import { matrixAttr } from '../../geometry/projection'
import { round as f } from '../../geometry/shapes'
import { RenderModeContext } from '../mode'
import { FONT_STACK } from '../theme'

/** A laid-out label: one <text> per line, with a halo in the background colour (none in PDFs). */
export const Label = memo(function Label({ layout, color, muted, halo }: { layout: LabelLayout; color: string; muted: string; halo: string }) {
  const { pdfFont } = useContext(RenderModeContext)
  return (
    <g transform={matrixAttr(layout.matrix)} fontFamily={pdfFont ?? FONT_STACK} textAnchor={layout.anchor}>
      {layout.lines.map((l, i) =>
        pdfFont ? (
          <text key={i} x={f(l.x)} y={f(l.y)} fontSize={l.size} fontWeight={l.weight >= 550 ? 'bold' : 'normal'} fill={l.muted ? muted : color}>
            {l.text}
          </text>
        ) : (
          <text
            key={i}
            className="ap-halo"
            x={f(l.x)}
            y={f(l.y)}
            fontSize={l.size}
            fontWeight={l.weight}
            fill={l.muted ? muted : color}
            stroke={halo}
            strokeWidth={3}
            strokeLinejoin="round"
            paintOrder="stroke"
          >
            {l.text}
          </text>
        ),
      )}
    </g>
  )
})

