import { EyeOff, Lock } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useState } from 'react'
import { toggleFlag } from '../../commands/edit'
import { select } from '../../commands/selection'
import { KIND_META } from '../../model/kinds'
import { flaggedItems } from '../../model/visibility'
import { usePage } from '../../store/selectors'
import { Button, Tip } from '../../ui'

/** Top-bar list of items the user locked or hid, so they can be found and released again. Shown only when there are any. */
export function FlaggedMenu() {
  const items = flaggedItems(usePage())
  const [open, setOpen] = useState(false)
  if (!items.length) return null
  const label = `Locked & hidden · ${items.length}`
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Tip label={label}>
        <Popover.Trigger asChild>
          <Button size="bar" className="relative">
            <EyeOff className="size-[19px]" />
            <span className="absolute top-1 right-1 min-w-3.5 rounded-full bg-accent px-1 font-mono text-[9.5px] leading-3.5 text-white tabular-nums">{items.length}</span>
          </Button>
        </Popover.Trigger>
      </Tip>
      <Popover.Portal>
        <Popover.Content align="end" sideOffset={10} className="ap-enter ap-float z-50 w-64 rounded-xl p-1">
          <div className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{label}</div>
          <ul className="max-h-80 space-y-0.5 overflow-y-auto" aria-label="Locked and hidden items">
            {items.map((it) => {
              const kind = KIND_META[it.kind].label
              const name = it.name || kind
              return (
                <li key={it.id} className="flex items-center gap-1 rounded-lg pr-1 pl-2.5 hover:bg-chip">
                  <Tip label="Select" name={false}>
                    <button
                      className="min-w-0 flex-1 truncate py-1.5 text-left text-[12.5px] text-ink"
                      onClick={() => {
                        select([it.id])
                        setOpen(false)
                      }}
                    >
                      {name}
                      <span className="ml-1.5 text-[11px] text-ink-faint">{kind.toLowerCase()}</span>
                    </button>
                  </Tip>
                  {it.locked && (
                    <Tip label={`Unlock ${name}`}>
                      <Button size="icon" className="size-7" onClick={() => toggleFlag([it.id], 'locked', false)}>
                        <Lock className="size-3.5" />
                      </Button>
                    </Tip>
                  )}
                  {it.hidden && (
                    <Tip label={`Show ${name}`}>
                      <Button size="icon" className="size-7" onClick={() => toggleFlag([it.id], 'hidden', false)}>
                        <EyeOff className="size-3.5" />
                      </Button>
                    </Tip>
                  )}
                </li>
              )
            })}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
