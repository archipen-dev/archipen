import { ArrowRight, Trash2 } from 'lucide-react'
import type { StoredDoc } from '../../io/autosave'
import { timeAgo } from '../../lib/time'
import type { Doc } from '../../model/schema'
import { DiagramPreview } from './DiagramPreview'
import { HomeSection, Thumb } from './HomeSection'

const nodeCount = (doc: Doc) => doc.pages.reduce((n, p) => n + p.nodes.length, 0)

export interface RecentGridProps {
  docs: StoredDoc[] | undefined
  loading: boolean
  onOpen: (doc: Doc, dirty: boolean) => void
  onRemove: (doc: Doc) => void
}

/** Diagrams autosaved in this browser, newest first. */
export function RecentGrid({ docs, loading, onOpen, onRemove }: RecentGridProps) {
  return (
    <HomeSection title="Recent in this browser" note="Autosaved locally · save to disk to keep a file">
      {docs?.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4">
          {docs.map((s, i) => (
            <RecentCard key={s.doc.id} stored={s} index={i} onOpen={onOpen} onRemove={onRemove} />
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong px-6 py-10 text-center text-[13px] text-ink-muted">
          {loading ? 'Loading…' : 'Nothing here yet. Create a diagram, or drop a .json file anywhere on this page.'}
        </div>
      )}
    </HomeSection>
  )
}

function RecentCard({ stored: { doc, updatedAt, dirty }, index, onOpen, onRemove }: { stored: StoredDoc; index: number } & Pick<RecentGridProps, 'onOpen' | 'onRemove'>) {
  const open = () => onOpen(doc, !!dirty)
  return (
    <div
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => e.key === 'Enter' && open()}
      style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
      className="ap-enter group relative cursor-pointer overflow-hidden rounded-2xl border border-line bg-panel transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float"
    >
      <Thumb>
        <DiagramPreview doc={doc} />
      </Thumb>
      <div className="flex items-center gap-2 px-3.5 py-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13.5px] font-semibold">{doc.name || 'Untitled'}</div>
          <div className="text-[11.5px] text-ink-faint">
            {timeAgo(updatedAt)} · {nodeCount(doc)} nodes{doc.pages.length > 1 ? ` · ${doc.pages.length} pages` : ''}{dirty ? ' · not on disk' : ''}
          </div>
        </div>
        <button
          title="Remove from this browser"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(doc)
          }}
          className="grid size-7 place-items-center rounded-lg text-ink-faint opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-500/10 hover:text-red-500"
        >
          <Trash2 className="size-3.5" />
        </button>
        <ArrowRight className="size-4 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
      </div>
    </div>
  )
}
