import { memo, useContext } from 'react'
import type { SceneEdge } from '../../geometry/scene'
import { toPoints } from '../../geometry/shapes'
import { A11yTitle, RenderModeContext, useTag } from '../mode'
import { mix, type CanvasTheme } from '../theme'

/** A wire: wide invisible hit area (canvas only), the line, arrow heads, and animated flow dots. */
const FLOW_PERIOD = 18
const FLOW_DASH = 4
/** Seconds for the dots to move one period at speed 1 (about 43 diagram units per second). */
const FLOW_CYCLE_S = 0.42

export const EdgeShape = memo(function EdgeShape({ se, theme, animate }: { se: SceneEdge; theme: CanvasTheme; animate: boolean }) {
  const e = se.edge
  const tag = useTag(e.id, 'edge')
  const { bare } = useContext(RenderModeContext)
  const w = e.width
  const dash = e.style === 'dashed' ? `${w * 3} ${w * 2.5}` : e.style === 'dotted' ? `0.01 ${w * 2.2}` : undefined
  const dur = `${(FLOW_CYCLE_S / e.flow.speed).toFixed(3)}s`
  const flowColor = mix(e.color, '#ffffff', theme.name === 'dark' ? 0.7 : 0.62)
  const flows = !e.flow.enabled ? [] : e.flow.direction === 'both' ? ['forward', 'backward'] : [e.flow.direction]
  return (
    <g {...tag}>
      <A11yTitle id={e.id} />
      {!bare && <path d={se.d} fill="none" stroke="transparent" strokeWidth={w + 10} strokeLinecap="round" strokeLinejoin="round" className="ap-hit" />}
      <path d={se.d} fill="none" stroke={e.color} strokeWidth={w} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={dash} />
      {se.arrowEnd && <polygon points={toPoints(se.arrowEnd)} fill={e.color} stroke={e.color} strokeWidth={1} strokeLinejoin="round" />}
      {se.arrowStart && <polygon points={toPoints(se.arrowStart)} fill={e.color} stroke={e.color} strokeWidth={1} strokeLinejoin="round" />}
      {animate &&
        flows.map((dir, i) => (
          <path
            key={dir}
            className={`ap-flow ap-flow-${dir}`}
            d={se.d}
            fill="none"
            stroke={flowColor}
            strokeWidth={w + 1.5}
            strokeLinecap="round"
            strokeDasharray={`${FLOW_DASH} ${FLOW_PERIOD - FLOW_DASH}`}
            strokeDashoffset={i * (FLOW_PERIOD / 2)}
            style={{ animationDuration: dur }}
          />
        ))}
    </g>
  )
})


export const FLOW_CSS = `
.ap-flow { animation-name: ap-flow; animation-timing-function: linear; animation-iteration-count: infinite; }
.ap-flow-backward { animation-direction: reverse; }
@keyframes ap-flow { from { stroke-dashoffset: 0; } to { stroke-dashoffset: -${FLOW_PERIOD}; } }
@media (prefers-reduced-motion: reduce) { .ap-flow { animation: none; } }
`
