import { createContext, useContext, useId, type ReactNode } from 'react'
import { OverrideDot } from './OverrideDot'

/** The id of the enclosing Field's label, so inputs inside it are named by it. */
const FieldLabelContext = createContext<string | undefined>(undefined)
export const useFieldLabelId = () => useContext(FieldLabelContext)

export interface FieldProps {
  label: string
  hint?: string
  /** Show an override dot that resets the value. */
  overridden?: boolean
  onReset?: () => void
  children: ReactNode
}

/** A labelled row in a panel: label on the left, control on the right. */
export function Field({ label, children, hint, overridden, onReset }: FieldProps) {
  const labelId = useId()
  return (
    <div role="group" aria-labelledby={labelId} className="grid grid-cols-[84px_1fr] items-center gap-2 py-1">
      <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
        <span id={labelId}>{label}</span>
        {overridden && <OverrideDot onReset={onReset} />}
      </span>
      <div className="min-w-0">
        <FieldLabelContext.Provider value={labelId}>{children}</FieldLabelContext.Provider>
        {hint && <div className="mt-0.5 text-[11px] text-ink-faint">{hint}</div>}
      </div>
    </div>
  )
}
