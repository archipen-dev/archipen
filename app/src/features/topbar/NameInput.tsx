import type { InputHTMLAttributes } from 'react'
import { cx } from '../../lib/cx'
import { NAME_MIN_CH } from './fieldWidth'

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'style'> & {
  value: string
  /** Longest it grows, in characters. */
  maxCh: number
  /** Narrowest it shrinks to when the bar is crowded, in characters (never wider than the name itself). */
  minCh?: number
  /** Font classes; the field and its sizing copies must share them. */
  font: string
  /** Never narrower than this, in characters, even when the name is shorter. */
  floorCh?: number
  /** Show the name as plain text instead of a field. */
  asText?: boolean
}

/**
 * A name in the top bar, exactly as wide as its text (at most `maxCh`). When the bar is crowded it shrinks, but not
 * below the first `minCh` characters; long names are cut off without "…". Two hidden copies of the text in the same
 * grid cell set the widths: the full text the natural width, a copy capped at `minCh` the narrowest. No measuring
 * code. `size={1}` drops the input's own default width (about 20 characters).
 */
export function NameInput({ value, maxCh, minCh = NAME_MIN_CH, floorCh, font, asText, className, placeholder, ...rest }: Props) {
  const shown = value || placeholder || ''
  const copy = cx('invisible col-start-1 row-start-1 px-2 whitespace-pre', font)
  return (
    <span className={cx('grid grid-cols-[minmax(auto,1fr)]', font)} style={floorCh ? { minWidth: `calc(${floorCh}ch + 1rem)` } : undefined}>
      <span aria-hidden className={copy} style={{ maxWidth: `calc(${minCh}ch + 1rem)` }}>
        {shown}
      </span>
      <span aria-hidden className={cx(copy, 'overflow-hidden')} style={{ maxWidth: `calc(${maxCh}ch + 1rem)` }}>
        {shown}{' '}
      </span>
      {asText ? (
        <span aria-current={rest['aria-current']} className={cx('col-start-1 row-start-1 overflow-hidden px-2 whitespace-nowrap', font, className)}>
          {shown}
        </span>
      ) : (
        <input size={1} value={value} placeholder={placeholder} className={cx('col-start-1 row-start-1 h-8 w-full min-w-0 px-2', font, className)} {...rest} />
      )}
    </span>
  )
}
