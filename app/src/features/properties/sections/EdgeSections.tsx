import { ArrowLeftRight, RotateCcw } from 'lucide-react'
import { swapEdgeDirection } from '../../../commands/entity'
import { mutateEntity } from '../../../commands/mutate'
import { resolveEdge } from '../../../model/defaults'
import { displayName } from '../../../model/entities'
import { endId, type Doc, type EdgeData, type EdgeStyle, type Flow, type Port } from '../../../model/schema'
import { customCount, EDGE_LOOK_KEYS } from '../../../model/styles'
import { Button, Field, OverrideDot, Select } from '../../../ui'
import { EdgeStyleFields, FlowFields, FlowSwitch } from '../../style-fields'
import { StyleBadge } from '../StyleBadge'
import { patchItem, resetKeys, styleOps } from '../styleOps'
import { SavedSection } from '../SavedSection'

const PORT_OPTS: { value: Port | 'auto'; label: string }[] = [
  { value: 'auto', label: 'Auto' },
  { value: 'n', label: 'North' },
  { value: 'e', label: 'East' },
  { value: 's', label: 'South' },
  { value: 'w', label: 'West' },
]

const setPort = (id: string, end: 'from' | 'to', v: Port | 'auto') => mutateEntity<EdgeData>(id, (it) => void (it[end].port = v === 'auto' ? undefined : v))

/** Ends, sides and bends of a wire. */
export function EdgeRoute({ e, doc }: { e: EdgeData; doc: Doc }) {
  const bends = e.waypoints.length
  return (
    <SavedSection id="props.route" title="Route">
      <div className="mb-2 flex items-center gap-2 rounded-lg bg-chip px-2.5 py-2 text-[12px]">
        <span className="truncate font-medium text-ink">{displayName(doc, endId(e.from))}</span>
        <span className="text-ink-faint">→</span>
        <span className="truncate font-medium text-ink">{displayName(doc, endId(e.to))}</span>
        <Button size="sm" className="ml-auto" title="Swap direction" onClick={() => swapEdgeDirection(e.id)}>
          <ArrowLeftRight className="size-3.5" />
        </Button>
      </div>
      <Field label="From side">
        <Select value={e.from.port ?? 'auto'} options={PORT_OPTS} onChange={(v) => setPort(e.id, 'from', v)} />
      </Field>
      <Field label="To side">
        <Select value={e.to.port ?? 'auto'} options={PORT_OPTS} onChange={(v) => setPort(e.id, 'to', v)} />
      </Field>
      {bends > 0 && (
        <Field label="Bends">
          <Button size="sm" variant="subtle" onClick={() => patchItem<EdgeData>(e.id, { waypoints: [] })}>
            <RotateCcw className="size-3" /> Clear {bends} bend{bends > 1 ? 's' : ''}
          </Button>
        </Field>
      )}
    </SavedSection>
  )
}

export function EdgeAppearance({ e, doc }: { e: EdgeData; doc: Doc }) {
  return (
    <SavedSection id="props.appearance" title="Appearance" aside={<StyleBadge count={customCount(e, EDGE_LOOK_KEYS)} onReset={() => resetKeys<EdgeData>(e.id, EDGE_LOOK_KEYS)} />}>
      <EdgeStyleFields value={resolveEdge(doc.settings.styles, e)} over={e} {...styleOps<Omit<EdgeStyle, 'flow'>>(e.id)} />
      <Field label="Label at">
        <input
          type="range"
          className="ap-range w-full"
          min={0}
          max={1}
          step={0.01}
          value={e.labelAt}
          onChange={(ev) => patchItem<EdgeData>(e.id, { labelAt: Number(ev.target.value) }, 'labelAt')}
        />
      </Field>
    </SavedSection>
  )
}

/** The wire's own flow settings, over the diagram default. */
function flowOps(id: string) {
  return {
    set: (patch: Partial<Flow>, coalesce?: string) => mutateEntity<EdgeData>(id, (it) => void (it.flow = { ...it.flow, ...patch }), coalesce),
    reset: (key: keyof Flow) =>
      mutateEntity<EdgeData>(id, (it) => {
        if (!it.flow) return
        delete it.flow[key]
        if (!Object.keys(it.flow).length) it.flow = undefined
      }),
  }
}

export function EdgeFlow({ e, doc }: { e: EdgeData; doc: Doc }) {
  const ops = flowOps(e.id)
  const props = { value: resolveEdge(doc.settings.styles, e).flow, over: e.flow ?? {}, ...ops }
  return (
    <SavedSection
      id="props.flow"
      title="Flow"
      aside={
        <span className="flex items-center gap-2">
          {e.flow?.enabled !== undefined && <OverrideDot title="Use the diagram default" onReset={() => ops.reset('enabled')} />}
          <FlowSwitch {...props} />
        </span>
      }
    >
      <FlowFields {...props} />
    </SavedSection>
  )
}
