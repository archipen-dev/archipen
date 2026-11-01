import { Box, Cylinder, Image, Square } from 'lucide-react'
import { EDGE_COLORS, NOTE_COLORS, PALETTE, ZONE_PALETTE } from '../../model/defaults'
import type { EdgeStyle, Flow, NodeStyle, TextStyle, ZoneStyle } from '../../model/schema'
import { Field, NumberInput, Range, Segmented, Select, Swatches, Switch } from '../../ui'

/**
 * Style editors shared by the properties panel (one item, with override dots)
 * and the settings dialog (the diagram-wide defaults).
 *
 * `over` is the item's own overrides; leave it out when editing the defaults.
 * `set(patch, coalesce?)` writes values; `coalesce` merges slider drags into one undo step.
 */
export type StyleFieldProps<S> = {
  value: S
  over?: Partial<S>
  set: (patch: Partial<S>, coalesce?: string) => void
  reset?: (key: keyof S) => void
}
type Props<S> = StyleFieldProps<S>

/** Override-dot props for a field, when editing an item (not the defaults). */
function ov<S>({ over, reset }: Props<S>, key: keyof S) {
  return over ? { overridden: over[key] !== undefined, onReset: () => reset?.(key) } : {}
}

export function NodeShapeField(p: Props<NodeStyle>) {
  return (
    <Field label="Shape" {...ov(p, 'shape')}>
      <Segmented
        size="sm"
        className="w-full"
        value={p.value.shape}
        onChange={(shape) => p.set({ shape })}
        options={[
          { value: 'block', label: <Box className="size-3.5" />, title: 'Block' },
          { value: 'cylinder', label: <Cylinder className="size-3.5" />, title: 'Cylinder (database)' },
          { value: 'flat', label: <Square className="size-3.5" />, title: 'Flat tile' },
          { value: 'icon', label: <Image className="size-3.5" />, title: 'Icon only' },
        ]}
      />
    </Field>
  )
}

export function NodeLookFields(p: Props<NodeStyle>) {
  const v = p.value
  return (
    <>
      <Field label="Colour" {...ov(p, 'color')}>
        <Swatches value={v.color} colors={PALETTE} onChange={(color) => p.set({ color })} />
      </Field>
      <Field label="Outline" {...ov(p, 'outline')}>
        <NumberInput value={v.outline} min={0} max={6} step={0.5} onChange={(outline) => p.set({ outline })} suffix="px" />
      </Field>
    </>
  )
}

export function NodeIconFields(p: Props<NodeStyle> & { custom?: boolean }) {
  const v = p.value
  const iconOnly = v.shape === 'icon'
  return (
    <>
      <Field label="Placement" hint={v.iconPlacement === 'top' ? 'Projected flat onto the surface.' : undefined} {...ov(p, 'iconPlacement')}>
        <Select
          value={v.iconPlacement}
          onChange={(iconPlacement) => p.set({ iconPlacement })}
          options={[
            { value: 'top', label: iconOnly ? 'Flat on the ground' : 'On top face' },
            { value: 'billboard', label: 'Upright, facing you' },
            { value: 'wall-x', label: iconOnly ? 'Standing along X' : 'On left face' },
            { value: 'wall-y', label: iconOnly ? 'Standing along Y' : 'On right face' },
          ]}
        />
      </Field>
      <Field label="Icon size" {...ov(p, 'iconScale')}>
        <Range value={v.iconScale} min={0.3} max={2.5} step={0.05} onChange={(iconScale) => p.set({ iconScale }, 'iconScale')} />
      </Field>
      {!p.custom && (
        <Field label="Icon colour" {...ov(p, 'iconColor')}>
          <Swatches value={v.iconColor} auto="Automatic contrast colour" colors={['#ffffff', '#1c2130', ...PALETTE.slice(0, 5)]} onChange={(iconColor) => p.set({ iconColor })} />
        </Field>
      )}
    </>
  )
}

export function ZoneStyleFields(p: Props<ZoneStyle>) {
  const v = p.value
  return (
    <>
      <Field label="Colour" {...ov(p, 'color')}>
        <Swatches value={v.color} colors={ZONE_PALETTE} onChange={(color) => p.set({ color })} />
      </Field>
      <Field label="Border" {...ov(p, 'dashed')}>
        <Segmented
          size="sm"
          className="w-full"
          value={v.dashed ? 'dashed' : 'solid'}
          onChange={(b) => p.set({ dashed: b === 'dashed' })}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
          ]}
        />
      </Field>
      <Field label="Border width" {...ov(p, 'border')}>
        <NumberInput value={v.border} min={0} max={8} step={0.5} onChange={(border) => p.set({ border })} suffix="px" />
      </Field>
      <Field label="Fill" {...ov(p, 'fill')}>
        <Range value={v.fill} min={0} max={4} step={0.1} onChange={(fill) => p.set({ fill }, 'fill')} />
      </Field>
    </>
  )
}

export function EdgeStyleFields(p: Props<Omit<EdgeStyle, 'flow'>>) {
  const v = p.value
  return (
    <>
      <Field label="Arrows" {...ov(p, 'arrows')}>
        <Segmented
          size="sm"
          className="w-full"
          value={v.arrows}
          onChange={(arrows) => p.set({ arrows })}
          options={[
            { value: 'none', label: '—', title: 'No arrows' },
            { value: 'end', label: '→', title: 'At the end' },
            { value: 'start', label: '←', title: 'At the start' },
            { value: 'both', label: '↔', title: 'Both ends' },
          ]}
        />
      </Field>
      {v.arrows !== 'none' && (
        <Field label="Arrow size" {...ov(p, 'arrowSize')}>
          <Range value={v.arrowSize} min={0.4} max={3} step={0.1} onChange={(arrowSize) => p.set({ arrowSize }, 'arrowSize')} />
        </Field>
      )}
      <Field label="Line" {...ov(p, 'style')}>
        <Segmented
          size="sm"
          className="w-full"
          value={v.style}
          onChange={(style) => p.set({ style })}
          options={[
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'dotted', label: 'Dotted' },
          ]}
        />
      </Field>
      <Field label="Colour" {...ov(p, 'color')}>
        <Swatches value={v.color} colors={EDGE_COLORS} onChange={(color) => p.set({ color })} />
      </Field>
      <Field label="Width" {...ov(p, 'width')}>
        <NumberInput value={v.width} min={0.5} max={12} step={0.5} onChange={(width) => p.set({ width })} suffix="px" />
      </Field>
    </>
  )
}

export function FlowSwitch(p: Props<Flow>) {
  return <Switch checked={p.value.enabled} onChange={(enabled) => p.set({ enabled })} />
}

export function FlowFields(p: Props<Flow>) {
  const v = p.value
  if (!v.enabled) return <p className="text-[12px] text-ink-faint">Animate dots travelling along the wire.</p>
  return (
    <>
      <Field label="Direction" {...ov(p, 'direction')}>
        <Segmented
          size="sm"
          className="w-full"
          value={v.direction}
          onChange={(direction) => p.set({ direction })}
          options={[
            { value: 'forward', label: 'Forward' },
            { value: 'backward', label: 'Back' },
            { value: 'both', label: 'Both' },
          ]}
        />
      </Field>
      <Field label="Speed" {...ov(p, 'speed')}>
        <Range value={v.speed} min={0.2} max={4} step={0.1} onChange={(speed) => p.set({ speed }, 'speed')} />
      </Field>
    </>
  )
}

export function TextColorField(p: Props<TextStyle> & { note: boolean }) {
  return (
    <Field label={p.note ? 'Note colour' : 'Text colour'} {...ov(p, 'color')}>
      <Swatches
        value={p.value.color}
        auto={p.note ? undefined : 'Theme text colour'}
        colors={p.note ? NOTE_COLORS : ['#1c2130', '#646b7c', ...PALETTE.slice(0, 5)]}
        onChange={(color) => p.set({ color })}
      />
    </Field>
  )
}
