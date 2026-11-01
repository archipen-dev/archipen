import { useMemo } from 'react'
import { buildScene } from '../../geometry/scene'
import { pageView } from '../../model/pages'
import type { Doc } from '../../model/schema'
import { SceneView } from '../../render/Scene'
import { useCanvasTheme } from '../../store/theme'

/** A static, fitted drawing of a diagram's first page, for cards and the hero. */
export function DiagramPreview({ doc, animate = false, pad = 24 }: { doc: Doc; animate?: boolean; pad?: number }) {
  const theme = useCanvasTheme()
  const scene = useMemo(() => buildScene(pageView(doc), doc.settings.projection), [doc])
  const b = scene.bounds
  if (!b) return <div className="grid h-full place-items-center text-[12px] text-ink-faint">Empty</div>
  return (
    <svg viewBox={`${b.x - pad} ${b.y - pad} ${b.w + pad * 2} ${b.h + pad * 2}`} className="h-full w-full" preserveAspectRatio="xMidYMid meet">
      <SceneView scene={scene} assets={doc.assets} theme={theme} animate={animate} />
    </svg>
  )
}
