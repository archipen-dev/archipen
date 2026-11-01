import { Tooltip } from 'radix-ui'
import type { ReactNode } from 'react'

export interface TipProps {
  label: string
  /** Shortcut shown after the label, already formatted for the platform. */
  keys?: string
  side?: 'top' | 'bottom' | 'left' | 'right'
  /** Default true: the label also names the child. False for children with visible text, which names them already. */
  name?: boolean
  children: ReactNode
}

/**
 * Tooltip around a single focusable child. The label is also the child's accessible name (unless `name` is false),
 * so icon-only buttons are announced by screen readers; an `aria-label` set on the child itself takes precedence.
 */
export function Tip({ label, keys, children, side = 'bottom', name = true }: TipProps) {
  return (
    <Tooltip.Root delayDuration={350}>
      <Tooltip.Trigger asChild aria-label={name ? label : undefined}>
        {children}
      </Tooltip.Trigger>
      <Tooltip.Portal>
        <Tooltip.Content side={side} sideOffset={8} className="z-50 flex items-center gap-2 rounded-md bg-ink px-2 py-1.5 text-[11.5px] font-medium text-paper shadow-float">
          {label}
          {keys && <span className="font-mono text-[10.5px] opacity-60">{keys}</span>}
        </Tooltip.Content>
      </Tooltip.Portal>
    </Tooltip.Root>
  )
}
