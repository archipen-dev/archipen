import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { cx } from '../lib/cx'

/** Small uppercase heading used above groups of fields. */
export function Overline({ children, as: Tag = 'h3', className }: { children: ReactNode; as?: 'h3' | 'h4' | 'span'; className?: string }) {
  return <Tag className={cx('text-[10.5px] font-semibold tracking-[0.08em] text-ink-muted uppercase', className)}>{children}</Tag>
}

/** A collapsible group in a side panel. Pass `open` and `onOpenChange` to control it from outside. */
export function Section({
  title,
  children,
  defaultOpen = true,
  open: openProp,
  onOpenChange,
  aside,
}: {
  title: string
  children: ReactNode
  defaultOpen?: boolean
  open?: boolean
  onOpenChange?: (open: boolean) => void
  aside?: ReactNode
}) {
  const [openState, setOpenState] = useState(defaultOpen)
  const open = openProp ?? openState
  const toggle = () => (onOpenChange ? onOpenChange(!open) : setOpenState(!open))
  return (
    <section className="border-t border-line px-4 py-3 first:border-t-0">
      <div className="flex items-center justify-between">
        <button
          onClick={toggle}
          aria-expanded={open}
          className="flex items-center gap-1 text-[10.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase hover:text-ink-muted"
        >
          <ChevronDown className={cx('size-3 transition-transform', !open && '-rotate-90')} />
          {title}
        </button>
        {aside}
      </div>
      {open && <div className="mt-2">{children}</div>}
    </section>
  )
}
