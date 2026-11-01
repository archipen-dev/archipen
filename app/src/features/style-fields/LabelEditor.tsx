import { AlignCenter, AlignLeft, AlignRight, RotateCcw } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import type { LabelStyle } from '../../model/schema'
import { Button, Field, NumberInput, OverrideDot, Segmented, Switch } from '../../ui'

type Side = LabelStyle['side']
type Orientation = LabelStyle['orientation']

const ORIENTATIONS: { value: Orientation; title: string; glyph: ReactNode }[] = [
  {
    value: 'screen',
    title: 'Facing the screen',
    glyph: (
      <>
        <rect x="4" y="3" width="14" height="10" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
        <path d="M7 7h8M7 9.6h5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: 'ground-x',
    title: 'Flat on the ground, along X',
    glyph: (
      <>
        <path d="M11 2 20 7.5 11 13 2 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7.5 6 13.5 9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: 'ground-y',
    title: 'Flat on the ground, along Y',
    glyph: (
      <>
        <path d="M11 2 20 7.5 11 13 2 7.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M8.5 9.6 14.5 6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: 'wall-x',
    title: 'Standing upright, along X',
    glyph: (
      <>
        <path d="M4 2.5 18 9v5.5L4 8Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7 6.5l8 3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
  {
    value: 'wall-y',
    title: 'Standing upright, along Y',
    glyph: (
      <>
        <path d="M4 9 18 2.5V8L4 14.5Z" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round" />
        <path d="M7 10.3l8-3.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </>
    ),
  },
]

const SWITCHES: { key: 'inside' | 'showDescription' | 'hidden'; label: string }[] = [
  { key: 'inside', label: 'Inside' },
  { key: 'showDescription', label: 'Description' },
  { key: 'hidden', label: 'Hidden' },
]

function SidePicker({ value, onChange }: { value: Side; onChange: (s: Side) => void }) {
  const cell = (s: Side | null, key: string) =>
    s ? (
      <button
        key={key}
        title={s}
        onClick={() => onChange(s)}
        className={cx('grid place-items-center rounded-[5px] transition-colors', value === s ? 'bg-accent' : 'bg-line-strong/60 hover:bg-ink-faint/50')}
      >
        <span className={cx('rounded-full', s === 'center' ? 'size-1.5' : 'h-[3px] w-2.5', s === 'left' || s === 'right' ? 'rotate-90' : '', value === s ? 'bg-accent-ink' : 'bg-transparent')} />
      </button>
    ) : (
      <span key={key} />
    )
  return (
    <div className="relative inline-grid size-[66px] grid-cols-3 grid-rows-3 gap-[3px] rounded-lg bg-chip p-[3px]">
      {[null, 'top', null, 'left', 'center', 'right', null, 'bottom', null].map((s, i) => cell(s as Side | null, String(i)))}
    </div>
  )
}

export function LabelEditor({
  value,
  override,
  onChange,
  onReset,
  allowOrientation = true,
}: {
  value: LabelStyle
  /** Per-item overrides; when given, overridden fields get a reset dot. */
  override?: Partial<LabelStyle>
  onChange: (patch: Partial<LabelStyle>) => void
  onReset?: (key?: keyof LabelStyle) => void
  allowOrientation?: boolean
}) {
  const o = (k: keyof LabelStyle) => override !== undefined && k in override
  const reset = (k: keyof LabelStyle) => () => onReset?.(k)
  const anyOverride = override && Object.keys(override).length > 0
  return (
    <div className="space-y-0.5">
      <div className="flex items-start gap-3 pb-1">
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
            Side
            {o('side') && <OverrideDot title="Reset" onReset={reset('side')} />}
          </div>
          <SidePicker value={value.side} onChange={(side) => onChange({ side })} />
        </div>
        {allowOrientation && (
          <div className="min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-1.5 text-[11.5px] text-ink-muted">
              Direction
              {o('orientation') && <OverrideDot title="Reset" onReset={reset('orientation')} />}
            </div>
            <div className="grid grid-cols-3 gap-1">
              {ORIENTATIONS.map((x) => (
                <button
                  key={x.value}
                  title={x.title}
                  onClick={() => onChange({ orientation: x.value })}
                  className={cx(
                    'grid h-[31px] place-items-center rounded-md transition-colors',
                    value.orientation === x.value ? 'bg-accent-soft text-accent ring-1 ring-accent/40' : 'bg-chip text-ink-muted hover:text-ink',
                  )}
                >
                  <svg width="22" height="16" viewBox="0 0 22 16">
                    {x.glyph}
                  </svg>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <Field label="Align" overridden={o('align')} onReset={reset('align')}>
        <Segmented
          size="sm"
          className="w-full"
          value={value.align}
          onChange={(align) => onChange({ align })}
          options={[
            { value: 'start', label: <AlignLeft className="size-3.5" />, title: 'Start' },
            { value: 'middle', label: <AlignCenter className="size-3.5" />, title: 'Middle' },
            { value: 'end', label: <AlignRight className="size-3.5" />, title: 'End' },
          ]}
        />
      </Field>
      <Field label="Size" overridden={o('fontSize')} onReset={reset('fontSize')}>
        <NumberInput value={value.fontSize} min={4} max={200} onChange={(fontSize) => onChange({ fontSize })} suffix="px" />
      </Field>
      <Field label="Offset" overridden={o('offset')} onReset={reset('offset')}>
        <NumberInput value={value.offset} min={-200} max={400} onChange={(offset) => onChange({ offset })} suffix="px" />
      </Field>
      <div className="flex flex-wrap gap-x-4 gap-y-2 pt-1.5">
        {SWITCHES.map(({ key, label }) => (
          <span key={key} className="flex items-center gap-1">
            <Switch checked={value[key]} onChange={(v) => onChange({ [key]: v })} label={label} />
            {o(key) && <OverrideDot title="Reset" onReset={reset(key)} />}
          </span>
        ))}
      </div>
      {anyOverride && onReset && (
        <div className="pt-2">
          <Button size="sm" variant="subtle" onClick={() => onReset()}>
            <RotateCcw className="size-3" /> Reset label to default
          </Button>
        </div>
      )}
    </div>
  )
}
