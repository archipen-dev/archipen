import { cx } from '../lib/cx'

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="group inline-flex items-center gap-2 text-[12px] text-ink-muted">
      <span className={cx('relative h-[18px] w-[30px] rounded-full transition-colors duration-200', checked ? 'bg-accent' : 'bg-line-strong')}>
        <span className={cx('absolute top-[2px] left-[2px] size-[14px] rounded-full bg-white shadow transition-transform duration-200', checked && 'translate-x-[12px]')} />
      </span>
      {label}
    </button>
  )
}
