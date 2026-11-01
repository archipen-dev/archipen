import type { ReactNode } from 'react'

/** Full-screen message: loading, not found, errors. */
export function Notice({ title, children, action }: { title?: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="grid h-full place-items-center px-6">
      <div className="max-w-md text-center">
        {title && <div className="font-display text-2xl font-semibold">{title}</div>}
        {children && <div className="mt-2 text-ink-muted">{children}</div>}
        {action && <div className="mt-4 font-medium text-accent">{action}</div>}
      </div>
    </div>
  )
}

export const Loading = ({ children }: { children: ReactNode }) => <div className="grid h-full place-items-center text-ink-faint">{children}</div>
