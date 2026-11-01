import { RotateCcw } from 'lucide-react'

/** Section badge: "default", or "N custom" with a one-click reset. */
export function StyleBadge({ count, onReset }: { count: number; onReset: () => void }) {
  if (!count) return <span className="text-[10.5px] text-ink-faint">default</span>
  return (
    <button onClick={onReset} title="Use the diagram defaults for all of these" className="group flex items-center gap-1 text-[10.5px] text-accent">
      {count} custom
      <RotateCcw className="size-3 opacity-60 group-hover:opacity-100" />
    </button>
  )
}

/** "custom" or "default", for sections without a count. */
export const CustomTag = ({ custom }: { custom: boolean }) =>
  custom ? <span className="text-[10.5px] text-accent">custom</span> : <span className="text-[10.5px] text-ink-faint">default</span>
