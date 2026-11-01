import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cx } from '../lib/cx'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
  variant?: 'ghost' | 'primary' | 'subtle' | 'danger'
  size?: 'sm' | 'md' | 'icon' | 'bar'
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button({ active, variant = 'ghost', size = 'md', className, ...rest }, ref) {
  return (
    <button
      ref={ref}
      {...rest}
      className={cx(
        'inline-flex select-none items-center justify-center gap-1.5 rounded-lg font-medium transition-[background,color,box-shadow,transform] duration-150 active:scale-[0.97] disabled:pointer-events-none disabled:opacity-40',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/50',
        size === 'icon' && 'size-8',
        size === 'bar' && 'size-[38px] rounded-[10px]',
        size === 'sm' && 'h-7 px-2 text-[12px]',
        size === 'md' && 'h-8 px-3 text-[12.5px]',
        variant === 'ghost' && (active ? 'bg-accent-soft text-accent' : 'text-ink-muted hover:bg-chip hover:text-ink'),
        variant === 'subtle' && 'bg-chip text-ink hover:bg-chip-hover',
        variant === 'primary' && 'bg-ink text-paper hover:opacity-90',
        variant === 'danger' && 'text-ink-muted hover:bg-red-500/10 hover:text-red-500',
        className,
      )}
    />
  )
})
