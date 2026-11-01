import { memo, useContext } from 'react'
import type { SceneText } from '../../geometry/scene'
import { shade, toPoints } from '../../geometry/shapes'
import { A11yTitle, RenderModeContext, useTag } from '../mode'

/** A sticky note's paper. Plain text draws nothing here: its words are a label. */
export const TextShape = memo(function TextShape({ st }: { st: SceneText }) {
  const t = st.text
  const tag = useTag(t.id, 'text')
  const { bare } = useContext(RenderModeContext)
  if (t.kind === 'note' && st.poly) {
    const shadow = st.poly.map((q) => ({ x: q.x + 2, y: q.y + 3 }))
    return (
      <g {...tag}>
        <A11yTitle id={t.id} />
        <polygon points={toPoints(shadow)} fill="#000" opacity={0.08} />
        <polygon points={toPoints(st.poly)} fill={t.color} stroke={shade(t.color, -0.25)} strokeWidth={1} strokeLinejoin="round" />
      </g>
    )
  }
  // An empty group still marks the item for the canvas; exports don't need it.
  return bare ? null : <g {...tag} />
})

