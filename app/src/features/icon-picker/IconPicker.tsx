import { Search } from 'lucide-react'
import { Popover } from 'radix-ui'
import { useMemo, useRef, useState } from 'react'
import { importSvgIcons } from '../../commands/icons'
import { LUCIDE_NAMES, resolveIcon } from '../../icons/markup'
import { useVendorIcons } from '../../icons/vendorLoader'
import { VENDOR_ICONS } from '../../icons/vendorSet'
import type { Asset } from '../../model/schema'
import { useDoc } from '../../store/selectors'
import { CustomIcons } from './CustomIcons'
import { IconPreview } from './IconPreview'
import { LibraryIcons, VendorIcons, vendorGroups } from './LibraryIcons'

/** What to call the current icon on the trigger button. */
function iconLabel(value: string | undefined, assets: Record<string, Asset>) {
  const [kind, id] = value ? value.split(':', 2) : []
  if (kind === 'custom') return assets[id]?.name ?? 'Missing icon'
  if (kind === 'vendor') return VENDOR_ICONS[id]?.title ?? id
  return id ?? 'None'
}

/** Button showing the current icon; opens a searchable picker of uploaded, Lucide and vendor icons. */
export function IconPicker({ value, onChange }: { value: string | undefined; onChange: (ref: string | undefined) => void }) {
  const assets = useDoc().assets
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  // All vendor logos load once the picker opens; before that, only the current icon (if it needs them).
  useVendorIcons(open ? 'all' : [value])
  const query = q.toLowerCase().trim()
  const names = useMemo(() => LUCIDE_NAMES.filter((n) => n.includes(query)), [query])
  const vendors = useMemo(() => vendorGroups(query), [query])
  const custom = Object.values(assets).filter((a) => a.name.toLowerCase().includes(query))

  const pick = (ref: string | undefined) => {
    onChange(ref)
    setOpen(false)
  }
  const upload = () => fileRef.current?.click()

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button className="flex h-8 w-full items-center gap-2 rounded-lg border border-transparent bg-chip px-2 text-left text-[12.5px] text-ink hover:border-line">
          <span className="grid size-6 place-items-center rounded-md bg-panel-solid text-ink shadow-[0_0_0_1px_var(--line)]">
            <IconPreview icon={resolveIcon(value, assets)} size={15} />
          </span>
          <span className="truncate">{iconLabel(value, assets)}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content side="left" align="start" sideOffset={14} className="ap-enter ap-float z-50 w-[296px] rounded-xl p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search icons"
              className="h-8 w-full rounded-lg bg-chip pr-2 pl-8 text-[12.5px] text-ink outline-none placeholder:text-ink-faint focus:ring-2 focus:ring-accent/20"
            />
          </div>
          <div className="ap-scroll mt-2 max-h-[300px] overflow-y-auto pr-0.5">
            <CustomIcons assets={assets} matches={custom} value={value} onPick={pick} onUpload={upload} />
            <LibraryIcons names={names} value={value} onPick={pick} />
            <VendorIcons groups={vendors} value={value} onPick={pick} />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            multiple
            hidden
            onChange={async (e) => {
              const files = e.target.files
              if (!files?.length) return
              const icons = await importSvgIcons(Array.from(files))
              e.target.value = ''
              if (icons.length) pick(icons[icons.length - 1].ref)
            }}
          />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
