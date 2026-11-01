import { cx } from '../lib/cx'

const RAINBOW = 'conic-gradient(from 90deg, #f0532a, #f2a93b, #7dbb52, #2fb5a0, #4aa3df, #5b7cfa, #9b6cf0, #e5604f, #f0532a)'
const isHex = (s: string) => /^#[0-9a-f]{6}$/i.test(s)
const selectedRing = 'ring-2 ring-accent ring-offset-2 ring-offset-panel-solid'

export interface SwatchesProps {
  value: string
  colors: string[]
  onChange: (c: string) => void
  /** Offer an "Auto" swatch (value ''), with this tooltip. */
  auto?: string
}

/** Colour picker: palette swatches plus a custom colour well. */
export function Swatches({ value, colors, onChange, auto }: SwatchesProps) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {auto && (
        <button
          title={auto}
          onClick={() => onChange('')}
          className={cx('h-5 rounded-md bg-chip px-1.5 text-[10.5px] font-medium text-ink-muted transition-colors hover:text-ink', value === '' && `text-ink ${selectedRing}`)}
        >
          Auto
        </button>
      )}
      {colors.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => onChange(c)}
          className={cx('size-5 rounded-md transition-transform hover:scale-110', value.toLowerCase() === c.toLowerCase() && selectedRing)}
          style={{ background: c, boxShadow: 'inset 0 0 0 1px rgb(0 0 0 / 0.12)' }}
        />
      ))}
      <label title="Custom colour" className="relative size-5 cursor-pointer overflow-hidden rounded-md" style={{ background: RAINBOW }}>
        <input type="color" value={isHex(value) ? value : '#888888'} onChange={(e) => onChange(e.target.value)} className="absolute inset-0 cursor-pointer opacity-0" />
      </label>
    </div>
  )
}
