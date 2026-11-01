import { DropdownMenu } from 'radix-ui'
import { forwardRef, type ComponentPropsWithoutRef, type ReactNode } from 'react'
import { cx } from '../lib/cx'

/** Dropdown menu: a trigger element and its items. `align`: which edge of the trigger the menu lines up with. */
export function Menu({
  trigger,
  children,
  width = 'w-56',
  sideOffset = 10,
  align = 'end',
}: {
  trigger: ReactNode
  children: ReactNode
  width?: string
  sideOffset?: number
  align?: 'start' | 'end'
}) {
  return (
    <DropdownMenu.Root>
      {trigger}
      <DropdownMenu.Portal>
        <DropdownMenu.Content align={align} sideOffset={sideOffset} collisionPadding={12} className={cx('ap-enter ap-float z-50 rounded-xl p-1', width)}>
          {children}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

/** Wraps the element that opens the menu. */
export const MenuTrigger = forwardRef<HTMLButtonElement, ComponentPropsWithoutRef<typeof DropdownMenu.Trigger>>(function MenuTrigger({ children, ...rest }, ref) {
  // Passes on what a surrounding <Tip> adds (its name and hover/focus handlers), so menu buttons get tooltips too.
  return (
    <DropdownMenu.Trigger asChild ref={ref} {...rest}>
      {children}
    </DropdownMenu.Trigger>
  )
})

export function MenuLabel({ children }: { children: ReactNode }) {
  return <DropdownMenu.Label className="px-2.5 pt-1.5 pb-1 text-[10.5px] font-semibold tracking-[0.08em] text-ink-faint uppercase">{children}</DropdownMenu.Label>
}

export const MenuSeparator = () => <DropdownMenu.Separator className="my-1 h-px bg-line" />

/** Mutually exclusive options; choosing one keeps the menu open. */
export function MenuRadioGroup<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <DropdownMenu.RadioGroup aria-label={label} value={value} onValueChange={(v) => onChange(v as T)}>
      {options.map((o) => (
        <DropdownMenu.RadioItem
          key={o.value}
          value={o.value}
          onSelect={(e) => e.preventDefault()}
          className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-ink outline-none data-[highlighted]:bg-chip"
        >
          <span className="relative grid size-4 place-items-center">
            <span className="size-3.5 rounded-full border border-line-strong" />
            <DropdownMenu.ItemIndicator className="absolute">
              <span className="block size-2 rounded-full bg-accent" />
            </DropdownMenu.ItemIndicator>
          </span>
          <span className="flex-1">{o.label}</span>
        </DropdownMenu.RadioItem>
      ))}
    </DropdownMenu.RadioGroup>
  )
}

export function MenuItem({ icon, label, hint, onSelect }: { icon: ReactNode; label: string; hint?: string; onSelect: () => void }) {
  return (
    <DropdownMenu.Item onSelect={onSelect} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-ink outline-none data-[highlighted]:bg-chip">
      <span className="text-ink-muted">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
    </DropdownMenu.Item>
  )
}
