import type { ReactNode } from 'react'

/** A titled band on the home page. */
export function HomeSection({ title, note, label, children }: { title: string; note: string; label?: string; children: ReactNode }) {
  return (
    <section className="mt-14" aria-label={label}>
      <div className="mb-4 flex items-baseline justify-between border-b border-line pb-3">
        <h2 className="font-display text-[20px] font-semibold tracking-tight">{title}</h2>
        <span className="text-[12px] text-ink-faint">{note}</span>
      </div>
      {children}
    </section>
  )
}

/** Card thumbnail frame. */
export const Thumb = ({ children }: { children: ReactNode }) => <div className="aspect-[16/10] border-b border-line bg-paper p-2">{children}</div>
