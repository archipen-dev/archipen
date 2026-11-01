import { Field, NumberInput } from '../../ui'

type Dim = 'w' | 'd' | 'h'
export type SizeValue = Partial<Record<Dim, number>>

export interface SizeFieldProps {
  /** Which dimensions to show, in order. */
  dims: Dim[]
  value: SizeValue
  onChange: (patch: SizeValue) => void
  min?: Partial<Record<Dim, number>>
  step?: Partial<Record<Dim, number>>
}

/** Width / depth / height inputs in one row. */
export function SizeField({ dims, value, onChange, min = {}, step = {} }: SizeFieldProps) {
  return (
    <Field label="Size">
      <div className={dims.length === 3 ? 'grid grid-cols-3 gap-1.5' : 'grid grid-cols-2 gap-1.5'}>
        {dims.map((k) => (
          <NumberInput key={k} value={value[k] ?? 0} min={min[k]} step={step[k]} onChange={(v) => onChange({ [k]: v })} suffix={k} />
        ))}
      </div>
    </Field>
  )
}

/** Node sizes: footprint in half cells, height in tenths. */
export const NODE_SIZE = { dims: ['w', 'd', 'h'] as Dim[], min: { w: 0.25, d: 0.25, h: 0 }, step: { w: 0.5, d: 0.5, h: 0.1 } }
export const NOTE_SIZE = { dims: ['w', 'd'] as Dim[], min: { w: 1, d: 1 }, step: { w: 0.5, d: 0.5 } }
export const ZONE_SIZE = { dims: ['w', 'd'] as Dim[], min: { w: 1, d: 1 } }
