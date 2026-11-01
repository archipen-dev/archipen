import { cx } from '../lib/cx'

/** Thin vertical rule between groups of toolbar buttons. `className` replaces the default margin. */
export const Divider = ({ className = 'mx-1' }: { className?: string }) => <div className={cx('h-5 w-px bg-line', className)} />
