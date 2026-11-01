import { ArrowDownLeft, ArrowRight, ArrowUpRight } from 'lucide-react'
import type { ReactNode } from 'react'
import { openPage } from '../../commands/pages'
import { clearSelection, select } from '../../commands/selection'
import { resolveIcon } from '../../icons/markup'
import { useVendorIcons } from '../../icons/vendorLoader'
import { resolveNode } from '../../model/defaults'
import { displayName, findEntity, wiresOf, type AnyEntity } from '../../model/entities'
import { entityLabel } from '../../model/kinds'
import { zoneDescendants } from '../../model/membership'
import { endId, type EdgeData, type PageDoc as Doc } from '../../model/schema'
import { useDoc, usePage } from '../../store/selectors'
import { useUi } from '../../store/uiStore'
import { KindIcon, PanelShell } from '../../ui'
import { IconPreview } from '../icon-picker'
import { SavedSection } from '../properties'

/** Read-only details for the selected item (view mode). */
export function DetailsPanel() {
  const doc = usePage()
  const selection = useUi((s) => s.selection)
  useVendorIcons(null) // re-render when the remaining vendor logos arrive (the canvas loads them)
  const ent = selection.length === 1 ? findEntity(doc, selection[0]) : null
  if (!ent) return null
  const it = ent.item
  return (
    <PanelShell title={entityLabel(ent)} icon={<KindIcon kind={ent.kind} />} onClose={clearSelection}>
      <Heading doc={doc} ent={ent} />
      {(ent.kind === 'node' || ent.kind === 'zone') && <ConnectionsSection doc={doc} id={it.id} />}
      {ent.kind === 'edge' && <RouteSection doc={doc} edge={ent.item} />}
      {ent.kind === 'zone' && <ContainsSection doc={doc} id={it.id} />}
    </PanelShell>
  )
}

function Heading({ doc, ent }: { doc: Doc; ent: AnyEntity }) {
  const it = ent.item
  return (
    <div className="px-4 pt-4 pb-3">
      <div className="flex items-start gap-3">
        {ent.kind === 'node' && ent.item.icon && (
          <span className="grid size-10 shrink-0 place-items-center rounded-xl text-white" style={{ background: resolveNode(doc.settings.styles, ent.item).color }}>
            <IconPreview icon={resolveIcon(ent.item.icon, doc.assets)} size={20} />
          </span>
        )}
        <h2 className="font-display text-[22px] leading-tight font-semibold tracking-tight text-ink">{it.name || <span className="text-ink-faint">Untitled</span>}</h2>
      </div>
      {it.description ? (
        <p className="mt-3 text-[13px] leading-relaxed whitespace-pre-wrap text-ink-muted">{it.description}</p>
      ) : (
        <p className="mt-3 text-[12.5px] text-ink-faint italic">No description.</p>
      )}
      {(ent.kind === 'node' || ent.kind === 'zone') && ent.item.link && <OpenPageButton page={ent.item.link.page} />}
    </div>
  )
}

/** For linked nodes and zones: go to the page with the details. */
function OpenPageButton({ page }: { page: string }) {
  const target = useDoc().pages.find((p) => p.id === page)
  if (!target) return null
  return (
    <button
      onClick={() => openPage(page)}
      className="mt-3 flex w-full items-center gap-2 rounded-xl bg-accent-soft px-3 py-2 text-left text-[12.5px] font-medium text-accent hover:bg-accent-soft/70"
    >
      <span className="flex-1 truncate">Open page “{target.name.trim() || 'Untitled page'}”</span>
      <ArrowRight className="size-3.5 shrink-0" />
    </button>
  )
}

/** A row that selects another item. */
function EntityLink({ id, children }: { id: string; children: ReactNode }) {
  return (
    <button onClick={() => select([id])} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[12.5px] text-ink hover:bg-chip">
      {children}
    </button>
  )
}

const Empty = ({ children }: { children: ReactNode }) => <div className="text-[12px] text-ink-faint">{children}</div>

function WireLink({ doc, edge, other, outgoing }: { doc: Doc; edge: EdgeData; other: string; outgoing: boolean }) {
  return (
    <EntityLink id={edge.id}>
      {outgoing ? <ArrowUpRight className="size-3.5 text-accent" /> : <ArrowDownLeft className="size-3.5 text-ink-faint" />}
      <span className="truncate">{displayName(doc, other)}</span>
      {edge.name && <span className="ml-auto truncate text-[11.5px] text-ink-faint">{edge.name}</span>}
    </EntityLink>
  )
}

function ConnectionsSection({ doc, id }: { doc: Doc; id: string }) {
  const wires = wiresOf(doc, id)
  return (
    <SavedSection id="details.connections" title="Connections">
      {!wires.out.length && !wires.in.length ? (
        <Empty>Not connected.</Empty>
      ) : (
        <div className="-mx-2">
          {wires.out.map((e) => (
            <WireLink key={e.id} doc={doc} edge={e} other={endId(e.to)} outgoing />
          ))}
          {wires.in.map((e) => (
            <WireLink key={e.id} doc={doc} edge={e} other={endId(e.from)} outgoing={false} />
          ))}
        </div>
      )}
    </SavedSection>
  )
}

function RouteSection({ doc, edge }: { doc: Doc; edge: EdgeData }) {
  return (
    <SavedSection id="details.route" title="Route">
      <div className="-mx-2">
        {(['from', 'to'] as const).map((end) => (
          <EntityLink key={end} id={endId(edge[end])}>
            <span className="text-ink-faint">{end === 'from' ? 'From' : 'To'}</span> {displayName(doc, endId(edge[end]))}
          </EntityLink>
        ))}
      </div>
    </SavedSection>
  )
}

function ContainsSection({ doc, id }: { doc: Doc; id: string }) {
  const ids = [...zoneDescendants(doc, id)]
  return (
    <SavedSection id="details.contains" title="Contains">
      {!ids.length ? (
        <Empty>Empty.</Empty>
      ) : (
        <div className="-mx-2">
          {ids.map((x) => (
            <EntityLink key={x} id={x}>
              {displayName(doc, x)}
            </EntityLink>
          ))}
        </div>
      )}
    </SavedSection>
  )
}
