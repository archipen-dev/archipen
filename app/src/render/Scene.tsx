import { forwardRef, memo, useContext } from 'react'
import type { Scene } from '../geometry/scene'
import { toPoints } from '../geometry/shapes'
import { resolveIcon } from '../icons/markup'
import { useVendorIcons } from '../icons/vendorLoader'
import type { Asset } from '../model/schema'
import { RenderModeContext, tagAttrs, useDecorative } from './mode'
import { EdgeShape, FLOW_CSS } from './shapes/EdgeShape'
import { Label } from './shapes/Label'
import { NodeShape } from './shapes/NodeShape'
import { TextShape } from './shapes/TextShape'
import { ZoneShape, zoneInk } from './shapes/ZoneShape'
import { mix, type CanvasTheme } from './theme'

interface Props {
  scene: Scene
  assets: Record<string, Asset>
  theme: CanvasTheme
  animate?: boolean
  /** Ids to highlight; everything else is dimmed (presentation focus). */
  focus?: string[] | null
}

const FOCUS_BASE = '.ap-focusing [data-id]{opacity:.16;transition:opacity .25s ease}.ap-focusing .ap-xray{opacity:.12}'
const focusCss = (ids: string[]) => `${FOCUS_BASE}${ids.map((id) => `.ap-focusing [data-id="${CSS.escape(id)}"]`).join(',')}{opacity:1}`

/** The pure diagram drawing. Used for the live canvas and, inside a bare RenderModeContext, for exports (see export/buildSvg). */
export const SceneView = memo(
  forwardRef<SVGGElement, Props>(function SceneView({ scene, assets, theme, animate = true, focus }, ref) {
    const p = scene.projection
    const { bare } = useContext(RenderModeContext)
    // In exports, labels repeat their shape's description, so screen readers skip them.
    const decorative = useDecorative()
    const labelTag = (id: string, kind: string) => ({ ...tagAttrs(bare, id, kind, true), ...decorative })
    // Loads the remaining vendor logos when a node uses one, and re-renders once they arrive.
    useVendorIcons(scene.nodes.map((n) => n.node.icon))
    // In iso, zone labels lying on the ground are printed on the floor (under blocks).
    const onFloor = (l: NonNullable<Scene['zones'][number]['label']>) => p === 'iso' && l.matrix.c !== 0
    const zoneLabel = (z: Scene['zones'][number]) => (
      <g key={`l-${z.zone.id}`} {...labelTag(z.zone.id, 'zone')}>
        <Label layout={z.label!} color={zoneInk(z.zone.color, theme)} muted={theme.muted} halo={mix(theme.bg, z.zone.color, Math.min(theme.zoneTint * z.zone.fill, 0.9))} />
      </g>
    )
    return (
      <g ref={ref} className={focus?.length ? 'ap-scene ap-focusing' : 'ap-scene'}>
        {(!bare || animate) && <style>{FLOW_CSS}</style>}
        {focus?.length ? <style>{focusCss(focus)}</style> : null}
        <g className="ap-zones">
          {scene.zones.map((z) => (
            <ZoneShape key={z.zone.id} sz={z} theme={theme} />
          ))}
          {scene.zones.map((z) => z.label && onFloor(z.label) && zoneLabel(z))}
        </g>
        <g className="ap-notes">
          {scene.texts
            .filter((t) => t.text.kind === 'note')
            .map((t) => (
              <TextShape key={t.text.id} st={t} />
            ))}
        </g>
        <g className="ap-edges">
          {scene.edges.map((e) => (
            <EdgeShape key={e.edge.id} se={e} theme={theme} animate={animate} />
          ))}
        </g>
        <g className="ap-nodes">
          {scene.nodes.map((n) => (
            <NodeShape key={n.node.id} sn={n} p={p} theme={theme} icon={resolveIcon(n.node.icon, assets)} />
          ))}
        </g>
        <g className="ap-xray" opacity={0.5} pointerEvents="none">
          {scene.edges.map(
            (e) =>
              e.xray && (
                <g key={e.edge.id}>
                  <path d={e.xray.d} fill="none" stroke={e.edge.color} strokeWidth={Math.max(1, e.edge.width * 0.75)} strokeDasharray="3 3" strokeLinecap="round" />
                  {e.xray.arrows.map((a, i) => (
                    <polygon key={i} points={toPoints(a)} fill={e.edge.color} />
                  ))}
                </g>
              ),
          )}
        </g>
        <g className="ap-labels">
          {scene.zones.map((z) => z.label && !onFloor(z.label) && zoneLabel(z))}
          {scene.edges.map(
            (e) =>
              e.label && (
                <g key={e.edge.id} {...labelTag(e.edge.id, 'edge')}>
                  <Label layout={e.label} color={theme.text} muted={theme.muted} halo={theme.bg} />
                </g>
              ),
          )}
          {scene.nodes.map(
            (n) =>
              n.label && (
                <g key={n.node.id} {...labelTag(n.node.id, 'node')}>
                  <Label layout={n.label} color={theme.text} muted={theme.muted} halo={theme.bg} />
                </g>
              ),
          )}
          {scene.texts.map((t) =>
            t.label ? (
              // Plain text draws no shape, so its label is what screen readers read.
              <g key={t.text.id} {...(t.text.kind === 'note' ? labelTag(t.text.id, 'text') : tagAttrs(bare, t.text.id, 'text', true))}>
                {t.text.kind === 'note' ? (
                  <Label layout={t.label} color="#3a321c" muted="#6b5d36" halo={t.text.color} />
                ) : (
                  <Label layout={t.label} color={t.text.color || theme.text} muted={theme.muted} halo={theme.bg} />
                )}
              </g>
            ) : null,
          )}
        </g>
      </g>
    )
  }),
)
