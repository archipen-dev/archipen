import { useEffect, useState } from 'react'
import { useUi } from '../../store/uiStore'

/** Brief hint shown when presentation starts. */
export function PresentHint() {
  const [visible, setVisible] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 2600)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      className="ap-float pointer-events-none absolute bottom-4 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full px-3.5 py-1.5 text-[11.5px] font-medium text-ink-muted transition-opacity duration-700"
      style={{ opacity: visible ? 1 : 0 }}
    >
      Click an item to focus it · <kbd>Esc</kbd> to exit
    </div>
  )
}

/** Bottom-centre note in view mode. On narrow screens it moves clear of the zoom controls. */
export function ReadOnlyBadge() {
  const wide = useUi((s) => s.canvasSize.w > 900)
  return (
    <div
      className="ap-float ap-enter pointer-events-none absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full px-3.5 py-1.5 text-[11.5px] font-medium text-ink-muted"
      style={{ marginLeft: wide ? 0 : 60 }}
    >
      Shared diagram · read-only · click anything for details
    </div>
  )
}

export function DropOverlay() {
  return (
    <div className="pointer-events-none absolute inset-3 z-30 grid place-items-center rounded-3xl border-2 border-dashed border-accent bg-accent-soft">
      <div className="ap-float rounded-xl px-4 py-2.5 text-[13px] font-medium text-ink">Drop an SVG to add it as an icon, or a .json diagram to open it</div>
    </div>
  )
}
