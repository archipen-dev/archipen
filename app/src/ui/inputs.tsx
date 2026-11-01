import { ChevronDown } from 'lucide-react'
import { forwardRef, useId, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cx } from '../lib/cx'
import { useFieldLabelId } from './Field'

export const inputClass =
  'w-full rounded-lg border border-transparent bg-chip px-2.5 text-[12.5px] text-ink placeholder:text-ink-faint outline-none transition-colors hover:border-line focus:border-accent focus:bg-panel-solid focus:ring-[3px] focus:ring-accent/15'

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput({ className, ...rest }, ref) {
  const labelId = useFieldLabelId()
  return <input ref={ref} aria-labelledby={rest['aria-label'] ? undefined : labelId} {...rest} className={cx(inputClass, 'h-8', className)} />
})

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea({ className, ...rest }, ref) {
  const labelId = useFieldLabelId()
  return (
    <textarea
      ref={ref}
      aria-labelledby={rest['aria-label'] ? undefined : labelId}
      {...rest}
      className={cx(inputClass, 'ap-scroll min-h-16 resize-y py-2 leading-relaxed', className)}
    />
  )
})

const round3 = (v: number) => Math.round(v * 1000) / 1000

export interface NumberInputProps {
  value: number
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  suffix?: string
}

/** Number input that commits on blur/Enter and steps with the arrow keys (Shift: ×10). */
export function NumberInput({ value, onChange, step = 1, min = -Infinity, max = Infinity, suffix }: NumberInputProps) {
  const [draft, setDraft] = useState<string | null>(null)
  // Named by the field's label plus the unit, e.g. "Size w".
  const labelId = useFieldLabelId()
  const suffixId = useId()
  const clamp = (v: number) => Math.min(max, Math.max(min, v))
  const commit = (s: string) => {
    const v = parseFloat(s)
    if (Number.isFinite(v)) onChange(clamp(round3(v)))
    setDraft(null)
  }
  return (
    <div className="relative">
      <input
        aria-labelledby={[labelId, suffix && suffixId].filter(Boolean).join(' ') || undefined}
        value={draft ?? String(Math.round(value * 100) / 100)}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(e.currentTarget.value)
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault()
            const k = (e.shiftKey ? 10 : 1) * step * (e.key === 'ArrowUp' ? 1 : -1)
            onChange(clamp(round3(value + k)))
            setDraft(null)
          }
        }}
        className={cx(inputClass, 'h-8 font-mono text-[12px] tabular-nums', suffix && 'pr-7')}
      />
      {suffix && (
        <span id={suffixId} className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 font-mono text-[10.5px] text-ink-muted">
          {suffix}
        </span>
      )}
    </div>
  )
}

export interface SelectProps<T extends string> {
  value: T
  options: { value: T; label: string }[]
  onChange: (v: T) => void
}

export function Select<T extends string>({ value, options, onChange }: SelectProps<T>) {
  const labelId = useFieldLabelId()
  return (
    <div className="relative">
      <select aria-labelledby={labelId} value={value} onChange={(e) => onChange(e.target.value as T)} className={cx(inputClass, 'h-8 appearance-none pr-7')}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2 text-ink-faint" />
    </div>
  )
}

/** Slider with its value printed to the right. */
export function Range({ value, min, max, step, onChange }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void }) {
  const labelId = useFieldLabelId()
  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-labelledby={labelId}
        className="ap-range min-w-0 flex-1"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <span className="w-8 text-right font-mono text-[11px] text-ink-muted tabular-nums">{value.toFixed(1)}</span>
    </div>
  )
}
