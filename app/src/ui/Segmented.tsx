import type { ReactNode } from 'react'
import { cx } from '../lib/cx'
import { Tip } from './Tip'

export interface SegmentedOption<T extends string> {
  value: T
  label: ReactNode
  /** Tooltip. It also names options whose label is an icon or a symbol. */
  title?: string
  /** Shortcut shown in the tooltip, already formatted for the platform. */
  keys?: string
}

/** A label made of letters or digits names its button itself; icons and symbols like "→" need the tooltip text. */
const hasText = (label: ReactNode) => typeof label === 'string' && /[\p{L}\p{N}]/u.test(label)

export interface SegmentedProps<T extends string> {
  value: T | undefined
  options: SegmentedOption<T>[]
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md' | 'lg'
  /** false: no grey track behind the buttons, the caller styles the container (e.g. a floating bar). */
  track?: boolean
}

/** A row of mutually exclusive buttons. */
export function Segmented<T extends string>({ value, options, onChange, className, size = 'md', track = true }: SegmentedProps<T>) {
  return (
    <div className={cx('inline-flex', track && 'rounded-lg bg-chip p-0.5', className)}>
      {options.map((o) => {
        const button = (
          <button
            key={o.value}
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className={cx(
              'inline-flex flex-1 items-center justify-center gap-1 font-medium transition-all duration-150',
              size === 'sm' && 'h-6 rounded-[7px] px-2 text-[11.5px]',
              size === 'md' && 'h-7 rounded-[7px] px-2.5 text-[12px]',
              size === 'lg' && 'h-[38px] rounded-[10px] px-3.5 text-[13px]',
              value === o.value
                ? track
                  ? 'bg-panel-solid text-ink shadow-[0_1px_2px_rgb(0_0_0/0.12),0_0_0_0.5px_var(--line-strong)]'
                  : 'bg-ink text-paper shadow-[0_2px_8px_-2px_rgb(0_0_0/0.35)]' // like the selected tool in the palette
                : track
                  ? 'text-ink-muted hover:text-ink'
                  : 'text-ink-muted hover:bg-chip hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
        return o.title ? (
          <Tip key={o.value} label={o.title} keys={o.keys} name={!hasText(o.label)}>
            {button}
          </Tip>
        ) : (
          button
        )
      })}
    </div>
  )
}
