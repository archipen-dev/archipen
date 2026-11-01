import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'

/** One square in the picker grid. */
export function IconCell({ title, label, selected, onPick, children }: { title: string; label?: string; selected: boolean; onPick: () => void; children: ReactNode }) {
  return (
    <button
      title={title}
      aria-label={label}
      onClick={onPick}
      className={cx('grid aspect-square w-full place-items-center rounded-lg text-ink-muted hover:bg-chip hover:text-ink', selected && 'bg-accent-soft text-accent ring-1 ring-accent/40')}
    >
      {children}
    </button>
  )
}

export const IconGrid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-7 gap-1">{children}</div>

export const GroupTitle = ({ children, className }: { children: ReactNode; className?: string }) => (
  <span className={cx('text-[10.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase', className)}>{children}</span>
)
