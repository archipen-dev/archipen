import { Layers } from 'lucide-react'
import { arrange, matchNodeSize, setColor } from '../../commands/edit'
import { clearSelection } from '../../commands/selection'
import type { Axis } from '../../model/arrange'
import { PALETTE } from '../../model/defaults'
import { findEntities, type AnyEntity } from '../../model/entities'
import { ENTITY_KINDS, KIND_META } from '../../model/kinds'
import { useDoc } from '../../store/selectors'
import { Button, Field, PanelShell, Swatches } from '../../ui'
import { ItemActions } from './ItemActions'
import { SavedSection } from './SavedSection'

/** Several items selected: what they are, arrange them, recolour them. */
export function MultiSelectionPanel({ ids }: { ids: string[] }) {
  const ents = findEntities(useDoc(), ids)
  const count = (pred: (e: AnyEntity) => boolean) => ents.filter(pred).length
  const arrangeable = count((e) => e.kind !== 'edge')
  const nodes = count((e) => e.kind === 'node')
  const colorable = count((e) => e.kind !== 'text')
  return (
    <PanelShell title={`${ids.length} selected`} icon={<Layers className="size-3.5" />} onClose={clearSelection} footer={<ItemActions ids={ids} />}>
      <SavedSection id="multi.selection" title="Selection">
        <div className="flex flex-wrap gap-1.5">
          {ENTITY_KINDS.map((k) => {
            const n = count((e) => e.kind === k)
            return n ? (
              <span key={k} className="rounded-md bg-chip px-2 py-1 text-[11.5px] text-ink-muted">
                {n} {n === 1 ? KIND_META[k].one : KIND_META[k].plural}
              </span>
            ) : null
          })}
        </div>
      </SavedSection>
      {arrangeable > 1 && (
        <SavedSection id="multi.arrange" title="Arrange">
          {(['x', 'y'] as const).map((axis) => (
            <ArrangeRow key={axis} axis={axis} ids={ids} canDistribute={arrangeable > 2} />
          ))}
          {nodes > 1 && (
            <Field label="Size">
              <Button size="sm" variant="subtle" className="w-full" title="Give all selected nodes the width and depth of the first one" onClick={() => matchNodeSize(ids)}>
                Match first node
              </Button>
            </Field>
          )}
        </SavedSection>
      )}
      {colorable > 0 && (
        <SavedSection id="multi.colour" title="Colour">
          <Swatches value="" colors={PALETTE} onChange={(c) => setColor(ids, c)} />
        </SavedSection>
      )}
    </PanelShell>
  )
}

function ArrangeRow({ axis, ids, canDistribute }: { axis: Axis; ids: string[]; canDistribute: boolean }) {
  const A = axis.toUpperCase()
  const buttons = [
    { label: 'Start', title: `Align to the smallest ${A}`, run: () => arrange(ids, { kind: 'align', axis, to: 'start' }) },
    { label: 'Centre', title: `Centre along ${A}`, run: () => arrange(ids, { kind: 'align', axis, to: 'center' }) },
    { label: 'End', title: `Align to the largest ${A}`, run: () => arrange(ids, { kind: 'align', axis, to: 'end' }) },
    { label: 'Spread', title: `Equal gaps along ${A} (3 or more items)`, run: () => arrange(ids, { kind: 'distribute', axis }), disabled: !canDistribute },
  ]
  return (
    <Field label={`Along ${A}`}>
      <div className="flex gap-1">
        {buttons.map((b) => (
          <Button key={b.label} size="sm" variant="subtle" className="flex-1 px-1" title={b.title} disabled={b.disabled} onClick={b.run}>
            {b.label}
          </Button>
        ))}
      </div>
    </Field>
  )
}
