import { Trash2, Upload } from 'lucide-react'
import { removeAsset } from '../../commands/document'
import { resolveIcon } from '../../icons/markup'
import type { Asset } from '../../model/schema'
import { GroupTitle, IconCell, IconGrid } from './IconCell'
import { IconPreview } from './IconPreview'

/** The document's uploaded SVGs, with upload and remove. */
export function CustomIcons({ assets, matches, value, onPick, onUpload }: { assets: Record<string, Asset>; matches: Asset[]; value?: string; onPick: (ref: string) => void; onUpload: () => void }) {
  return (
    <>
      <div className="mb-1 flex items-center justify-between px-1 pt-1">
        <GroupTitle>Your icons</GroupTitle>
        <button onClick={onUpload} className="flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11.5px] font-medium text-accent hover:bg-accent-soft">
          <Upload className="size-3" /> Upload SVG
        </button>
      </div>
      {matches.length === 0 ? (
        <button onClick={onUpload} className="mb-2 w-full rounded-lg border border-dashed border-line-strong px-3 py-3 text-[11.5px] text-ink-faint hover:border-accent hover:text-ink-muted">
          Drop in your own SVG logos or illustrations. Scripts and external links are removed.
        </button>
      ) : (
        <div className="mb-2">
          <IconGrid>
            {matches.map((a) => {
              const ref = `custom:${a.id}`
              return (
                <div key={a.id} className="group relative">
                  <IconCell title={a.name} selected={value === ref} onPick={() => onPick(ref)}>
                    <IconPreview icon={resolveIcon(ref, assets)} size={22} />
                  </IconCell>
                  <button
                    title="Remove from document"
                    onClick={() => removeAsset(a.id)}
                    className="absolute -top-1 -right-1 hidden size-4 place-items-center rounded-full bg-panel-solid text-ink-muted shadow group-hover:grid hover:text-red-500"
                  >
                    <Trash2 className="size-2.5" />
                  </button>
                </div>
              )
            })}
          </IconGrid>
        </div>
      )}
    </>
  )
}
