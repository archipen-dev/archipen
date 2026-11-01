import { fitAll, zoomIn, zoomOut, zoomTo } from '../../commands/view'
import { shortcut } from '../../keyboard/keys'
import { useUi } from '../../store/uiStore'
import { Button, Divider, Tip } from '../../ui'

export function ZoomControls() {
  const zoom = useUi((s) => s.viewport.zoom)
  return (
    <div onPointerDown={(e) => e.stopPropagation()} className="ap-float absolute bottom-3 left-3 z-10 flex h-12 items-center gap-0.5 rounded-2xl px-1">
      <Tip label="Zoom out" keys={shortcut('Mod+−')} side="top">
        <Button size="bar" onClick={zoomOut}>
          <span className="text-[19px] leading-none">−</span>
        </Button>
      </Tip>
      <Tip label="Reset to 100%" keys={shortcut('Shift+0')} side="top">
        <button
          onClick={() => zoomTo(1)}
          aria-label={`${Math.round(zoom * 100)}% zoom, reset to 100%`}
          className="h-[38px] w-[67px] rounded-[10px] font-mono text-[13px] text-ink-muted tabular-nums hover:bg-chip hover:text-ink"
        >
          {Math.round(zoom * 100)}%
        </button>
      </Tip>
      <Tip label="Zoom in" keys={shortcut('Mod++')} side="top">
        <Button size="bar" onClick={zoomIn}>
          <span className="text-[19px] leading-none">+</span>
        </Button>
      </Tip>
      <Divider className="mx-0.5" />
      <Tip label="Zoom to fit" keys={shortcut('Shift+1')} side="top">
        <Button size="sm" className="h-[34px] px-2.5 text-[13px]" onClick={fitAll}>
          Fit
        </Button>
      </Tip>
    </div>
  )
}
