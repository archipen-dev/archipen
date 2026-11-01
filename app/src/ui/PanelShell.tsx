import { X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Button } from './Button'

export interface PanelShellProps {
  title: string
  icon?: ReactNode
  /** Extra header controls, before the close button. */
  aside?: ReactNode
  onClose?: () => void
  /** Pinned under the header; doesn't scroll. */
  top?: ReactNode
  /** Pinned at the bottom; doesn't scroll. */
  footer?: ReactNode
  children: ReactNode
}

/** The floating side panel on the right of the canvas. */
export function PanelShell({ children, title, icon, aside, onClose, top, footer }: PanelShellProps) {
  return (
    <aside onPointerDown={(e) => e.stopPropagation()} className="ap-float ap-enter absolute top-[72px] right-3 bottom-3 z-10 flex w-[312px] flex-col overflow-hidden rounded-2xl">
      <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-4">
        {icon && <span className="text-ink-faint">{icon}</span>}
        <span className="text-[12.5px] font-semibold text-ink">{title}</span>
        <span className="ml-auto flex items-center gap-1">
          {aside}
          {onClose && (
            <Button size="icon" title="Close panel" aria-label="Close panel" onClick={onClose}>
              <X className="size-4" />
            </Button>
          )}
        </span>
      </header>
      {top && <div className="shrink-0 border-b border-line px-4 py-3">{top}</div>}
      <div className="ap-scroll min-h-0 flex-1 overflow-y-auto">{children}</div>
      {footer && <div className="shrink-0 border-t border-line">{footer}</div>}
    </aside>
  )
}
