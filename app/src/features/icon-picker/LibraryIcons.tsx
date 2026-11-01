import { Ban } from 'lucide-react'
import { resolveIcon } from '../../icons/markup'
import { VENDOR_CATEGORIES, VENDOR_ICONS } from '../../icons/vendorSet'
import { GroupTitle, IconCell, IconGrid } from './IconCell'
import { IconPreview } from './IconPreview'

/** "No icon" plus the matching Lucide icons. */
export function LibraryIcons({ names, value, onPick }: { names: string[]; value?: string; onPick: (ref: string | undefined) => void }) {
  return (
    <>
      <GroupTitle className="mb-1 block px-1">Library</GroupTitle>
      <IconGrid>
        <IconCell title="No icon" selected={!value} onPick={() => onPick(undefined)}>
          <Ban className="size-4 text-ink-faint" />
        </IconCell>
        {names.map((n) => (
          <IconCell key={n} title={n} selected={value === `lucide:${n}`} onPick={() => onPick(`lucide:${n}`)}>
            <IconPreview icon={resolveIcon(`lucide:${n}`, {})} size={17} />
          </IconCell>
        ))}
      </IconGrid>
    </>
  )
}

/** Vendor logos matching `query`, grouped by category; the query also matches category names ("languages", "ci/cd"). */
export function vendorGroups(query: string) {
  const hits = Object.entries(VENDOR_ICONS).filter(([slug, v]) => slug.includes(query) || v.title.toLowerCase().includes(query) || v.category.toLowerCase().includes(query))
  return VENDOR_CATEGORIES.map((category) => ({ category, icons: hits.filter(([, v]) => v.category === category) })).filter((g) => g.icons.length > 0)
}

/** A vendor logo; a faint placeholder while its shape is still loading. */
function VendorPreview({ slug }: { slug: string }) {
  const icon = resolveIcon(`vendor:${slug}`, {})
  return icon ? <IconPreview icon={icon} size={17} /> : <span className="size-[17px] animate-pulse rounded bg-chip" />
}

export function VendorIcons({ groups, value, onPick }: { groups: ReturnType<typeof vendorGroups>; value?: string; onPick: (ref: string) => void }) {
  if (!groups.length) return null
  return (
    <>
      <div className="mt-2 mb-1 flex items-center justify-between px-1">
        <GroupTitle>Vendors</GroupTitle>
        <a href="vendor-icon-credits.txt" target="_blank" rel="noreferrer" className="text-[11px] text-ink-faint hover:text-ink-muted hover:underline">
          Credits
        </a>
      </div>
      {groups.map(({ category, icons }) => (
        <div key={category} className="mb-1.5">
          <div className="mb-0.5 px-1 text-[11px] text-ink-faint">{category}</div>
          <IconGrid>
            {icons.map(([slug, v]) => (
              <IconCell key={slug} label={v.title} title={v.licence ? `${v.title} (${v.licence}, see Credits)` : v.title} selected={value === `vendor:${slug}`} onPick={() => onPick(`vendor:${slug}`)}>
                <VendorPreview slug={slug} />
              </IconCell>
            ))}
          </IconGrid>
        </div>
      ))}
    </>
  )
}
