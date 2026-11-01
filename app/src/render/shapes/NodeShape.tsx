import { memo, useContext, type ReactNode } from 'react'
import { orientationMatrix } from '../../geometry/planes'
import { COS30, groundMatrix, project, SIN30, TILE, type Mat2, type Projection, type Vec2 } from '../../geometry/projection'
import { iconSize, type SceneNode } from '../../geometry/scene'
import { center, convexHull, round as f, shade, toPoints, type Box } from '../../geometry/shapes'
import type { IconMarkup } from '../../icons/markup'
import { A11yTitle, LinkWrap, RenderModeContext, useTag } from '../mode'
import { contrast, inkOn, mix, type CanvasTheme } from '../theme'
import { IconGlyph } from './IconGlyph'
import { LinkBadge } from './LinkBadge'

/** Face colours of a node, from its base colour. */
function palette(color: string) {
  return { top: shade(color, 0.2), left: color, right: shade(color, -0.2), line: shade(color, -0.38) }
}

interface BodyProps {
  sn: SceneNode
  box: Box
  colors: ReturnType<typeof palette>
  outline: number
  theme: CanvasTheme
}

/** Icon-only nodes in iso: a soft shadow under the standing icon. */
function IconShadow({ box: b, theme }: BodyProps) {
  const c = center(b)
  const g = project(c.x, c.y, 0, 'iso')
  const r = (Math.min(b.w, b.d) / 2) * TILE * 0.7
  return <ellipse cx={f(g.x)} cy={f(g.y)} rx={f(r * COS30 * Math.SQRT2)} ry={f(r * SIN30 * Math.SQRT2)} fill={mix(theme.bg, '#000000', 0.12)} />
}

function Cylinder2d({ box: b, colors, outline }: BodyProps) {
  const c = center(b)
  const cc = project(c.x, c.y, 0, '2d')
  const rad = (Math.min(b.w, b.d) / 2) * TILE
  return (
    <>
      <circle cx={f(cc.x + 2)} cy={f(cc.y + 3)} r={f(rad)} fill="#000" opacity={0.08} />
      <circle cx={f(cc.x)} cy={f(cc.y)} r={f(rad)} fill={colors.top} stroke={colors.line} strokeWidth={outline} />
      <circle cx={f(cc.x)} cy={f(cc.y)} r={f(rad * 0.62)} fill="none" stroke={colors.line} strokeWidth={outline} opacity={0.35} />
    </>
  )
}

/** Blocks and flat tiles in 2D: a rounded rectangle with a drop shadow. */
function Rect2d({ sn, box: b, colors, outline }: BodyProps) {
  const r = { x: b.x * TILE, y: b.y * TILE, w: b.w * TILE, h: b.d * TILE }
  const rx = sn.node.shape === 'flat' ? 3 : 7
  return (
    <>
      <rect x={f(r.x + 2)} y={f(r.y + 3)} width={f(r.w)} height={f(r.h)} rx={rx} fill="#000" opacity={0.08} />
      <rect x={f(r.x)} y={f(r.y)} width={f(r.w)} height={f(r.h)} rx={rx} fill={colors.top} stroke={colors.line} strokeWidth={outline} />
    </>
  )
}

function CylinderIso({ sn, box: b, colors, outline }: BodyProps) {
  const n = sn.node
  const c = center(b)
  const rad = (Math.min(b.w, b.d) / 2) * TILE
  const rx = rad * COS30 * Math.SQRT2
  const ry = rad * SIN30 * Math.SQRT2
  const ct = project(c.x, c.y, b.h, 'iso')
  const cb = project(c.x, c.y, 0, 'iso')
  const gid = `ap-cyl-${n.id}`
  const band = ct.y + (cb.y - ct.y) * 0.33
  return (
    <>
      <defs>
        <linearGradient id={gid} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor={colors.left} />
          <stop offset="0.55" stopColor={shade(n.color, -0.05)} />
          <stop offset="1" stopColor={colors.right} />
        </linearGradient>
      </defs>
      <path
        d={`M${f(ct.x - rx)} ${f(ct.y)} L${f(cb.x - rx)} ${f(cb.y)} A${f(rx)} ${f(ry)} 0 0 0 ${f(cb.x + rx)} ${f(cb.y)} L${f(ct.x + rx)} ${f(ct.y)} Z`}
        fill={`url(#${gid})`}
        stroke={colors.line}
        strokeWidth={outline}
        strokeLinejoin="round"
      />
      {b.h > 0.5 && (
        <path d={`M${f(ct.x - rx)} ${f(band)} A${f(rx)} ${f(ry)} 0 0 0 ${f(ct.x + rx)} ${f(band)}`} fill="none" stroke={colors.line} strokeWidth={outline} opacity={0.3} />
      )}
      <ellipse cx={f(ct.x)} cy={f(ct.y)} rx={f(rx)} ry={f(ry)} fill={colors.top} stroke={colors.line} strokeWidth={outline} />
    </>
  )
}

/** Blocks and flat tiles in iso: three shaded faces. */
function BlockIso({ sn, colors, outline }: BodyProps) {
  const face = (pts: Vec2[], fill: string) => <polygon points={toPoints(pts)} fill={fill} stroke={colors.line} strokeWidth={outline} strokeLinejoin="round" />
  return (
    <>
      {face(sn.faces.left, colors.left)}
      {face(sn.faces.right, colors.right)}
      {face(sn.faces.top, colors.top)}
    </>
  )
}

/** Which body to draw for a node's shape in a projection (null: icon only, nothing under it). */
function bodyFor(sn: SceneNode, p: Projection): ((props: BodyProps) => ReactNode) | null {
  const { shape, iconPlacement } = sn.node
  if (shape === 'icon') return p === 'iso' && iconPlacement !== 'top' ? IconShadow : null
  if (p === '2d') return shape === 'cylinder' ? Cylinder2d : Rect2d
  return shape === 'cylinder' ? CylinderIso : BlockIso
}

/**
 * Below this contrast with what's behind it, a brand colour gives way to the automatic colour. On a face it's 3:1
 * (the WCAG minimum for graphics); on the open canvas the logo is bigger, so only near-invisible ones give way.
 */
const MIN_BRAND_CONTRAST = { face: 3, canvas: 1.5 }

/** Where and how the icon sits: on the top face, upright, or on a wall. */
function iconPlacement(sn: SceneNode, size: number, p: Projection): { m: Mat2; at: Vec2 } {
  const n = sn.node
  const b = sn.box
  const c = center(b)
  const isIconShape = n.shape === 'icon'
  if (p === '2d') return { m: { a: 1, b: 0, c: 0, d: 1 }, at: project(c.x, c.y, 0, p) }
  if (n.iconPlacement === 'top') return { m: groundMatrix(p), at: project(c.x, c.y, b.h, p) }
  if (n.iconPlacement === 'billboard') {
    const base = project(c.x, c.y, b.h, p)
    return { m: { a: 1, b: 0, c: 0, d: 1 }, at: { x: base.x, y: base.y - size / 2 - (isIconShape ? 2 : 6) } }
  }
  const m = orientationMatrix(n.iconPlacement, p)
  if (isIconShape) {
    const g = project(c.x, c.y, 0, p)
    return { m, at: { x: g.x + m.c * (-size / 2), y: g.y + m.d * (-size / 2) } }
  }
  return { m, at: n.iconPlacement === 'wall-x' ? project(c.x, b.y + b.d, b.h / 2, p) : project(b.x + b.w, c.y, b.h / 2, p) }
}

function NodeIcon({ sn, icon, p, theme }: { sn: SceneNode; icon: IconMarkup; p: Projection; theme: CanvasTheme }) {
  const n = sn.node
  const size = iconSize(n)
  const onCanvas = n.shape === 'icon' || n.iconPlacement === 'billboard'
  const behind = onCanvas ? theme.bg : shade(n.color, 0.18)
  const brand = icon.brandColor && contrast(icon.brandColor, behind) >= MIN_BRAND_CONTRAST[onCanvas ? 'canvas' : 'face'] ? icon.brandColor : ''
  const color = n.iconColor || brand || (onCanvas ? n.color : inkOn(behind))
  const { m, at } = iconPlacement(sn, size, p)
  return <IconGlyph icon={icon} size={size} color={color} m={m} at={at} />
}

export const NodeShape = memo(function NodeShape({ sn, p, theme, icon }: { sn: SceneNode; p: Projection; theme: CanvasTheme; icon: IconMarkup | null }) {
  const n = sn.node
  const tag = useTag(n.id, 'node')
  const { bare } = useContext(RenderModeContext)
  // bodyFor picks one of the module-level components above; nothing is created during render.
  const Body = bodyFor(sn, p)
  return (
    <LinkWrap id={n.id}>
      <g {...tag}>
        <A11yTitle id={n.id} />
        {/* Icon-only nodes have no body, so give the whole outline an invisible hit area (canvas only). */}
        {!bare && n.shape === 'icon' && <polygon points={toPoints(convexHull(sn.outline))} fill="transparent" className="ap-hit" />}
        {/* oxlint-disable-next-line react/static-components */}
        {Body && <Body sn={sn} box={sn.box} colors={palette(n.color)} outline={n.outline} theme={theme} />}
        {icon && <NodeIcon sn={sn} icon={icon} p={p} theme={theme} />}
        {n.link && <LinkBadge outline={sn.outline} theme={theme} />}
      </g>
    </LinkWrap>
  )
})
