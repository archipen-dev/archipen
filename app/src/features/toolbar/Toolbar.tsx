import { Box, Hand, MousePointer2, Spline, Square, StickyNote, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { isViewTool, TOOLS } from '../../keyboard/tools'
import { cx } from '../../lib/cx'
import { useUi, type Tool } from '../../store/uiStore'
import { Tip } from '../../ui'

const ICON: Record<Tool, ReactNode> = {
  select: <MousePointer2 className="size-[20px]" />,
  hand: <Hand className="size-[20px]" />,
  node: <Box className="size-[20px]" />,
  zone: <Square className="size-[20px]" strokeDasharray="4 3" />,
  connect: <Spline className="size-[20px]" />,
  text: <Type className="size-[20px]" />,
  note: <StickyNote className="size-[20px]" />,
}

/** Tool palette on the left. View mode only offers the tools that look around. */
export function Toolbar() {
  const tool = useUi((s) => s.tool)
  const mode = useUi((s) => s.mode)
  const setTool = useUi((s) => s.setTool)
  const tools = mode === 'edit' ? TOOLS : TOOLS.filter((t) => isViewTool(t.tool))
  return (
    <nav onPointerDown={(e) => e.stopPropagation()} className="ap-float absolute top-1/2 left-3 z-10 flex -translate-y-1/2 flex-col gap-0.5 rounded-2xl p-1.5">
      {tools.map((t, i) => (
        <div key={t.tool}>
          {i > 0 && isViewTool(tools[i - 1].tool) && !isViewTool(t.tool) && <div className="mx-auto my-1 h-px w-6 bg-line" />}
          <Tip label={t.label} keys={t.key} side="right">
            <button
              onClick={() => setTool(t.tool)}
              className={cx(
                'relative grid size-[43px] place-items-center rounded-xl transition-all duration-150 active:scale-95',
                tool === t.tool ? 'bg-ink text-paper shadow-[0_2px_8px_-2px_rgb(0_0_0/0.35)]' : 'text-ink-muted hover:bg-chip hover:text-ink',
              )}
            >
              {ICON[t.tool]}
            </button>
          </Tip>
        </div>
      ))}
    </nav>
  )
}
