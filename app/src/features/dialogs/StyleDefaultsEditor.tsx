import type { Draft } from 'immer'
import type { ReactNode } from 'react'
import { writeStyleDefaults } from '../../commands/document'
import type { EntityKind, Flow, NodeStyle, StyleDefaults } from '../../model/schema'
import { Field, Overline } from '../../ui'
import { IconPicker } from '../icon-picker'
import {
  EdgeStyleFields,
  FlowFields,
  FlowSwitch,
  NODE_SIZE,
  NodeIconFields,
  NodeLookFields,
  NodeShapeField,
  NOTE_SIZE,
  SizeField,
  TextColorField,
  ZoneStyleFields,
} from '../style-fields'

export function Heading({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-1.5 flex h-6 items-center justify-between">
      <Overline as="h4">{children}</Overline>
      {aside}
    </div>
  )
}

/** Diagram-wide style defaults for one kind of item. */
export function StyleDefaultsEditor({ kind, styles }: { kind: EntityKind; styles: StyleDefaults }) {
  const write = (fn: (s: Draft<StyleDefaults>) => void, coalesce?: string) => writeStyleDefaults(kind, fn, coalesce)
  switch (kind) {
    case 'node': {
      const node = { value: styles.node, set: (p: Partial<NodeStyle>, c?: string) => write((s) => void Object.assign(s.node, p), c) }
      return (
        <>
          <NodeShapeField {...node} />
          <NodeLookFields {...node} />
          <NodeIconFields {...node} />
          <Heading>New nodes</Heading>
          <SizeField {...NODE_SIZE} value={styles.node} onChange={(p) => write((s) => void Object.assign(s.node, p))} />
          <Field label="Icon">
            <IconPicker value={styles.node.icon || undefined} onChange={(icon) => write((s) => void (s.node.icon = icon ?? ''))} />
          </Field>
        </>
      )
    }
    case 'zone':
      return <ZoneStyleFields value={styles.zone} set={(p, c) => write((s) => void Object.assign(s.zone, p), c)} />
    case 'edge': {
      const flow = { value: styles.edge.flow, set: (p: Partial<Flow>, c?: string) => write((s) => void Object.assign(s.edge.flow, p), c) }
      return (
        <>
          <EdgeStyleFields value={styles.edge} set={(p, c) => write((s) => void Object.assign(s.edge, p), c)} />
          <Heading aside={<FlowSwitch {...flow} />}>Flow</Heading>
          <FlowFields {...flow} />
        </>
      )
    }
    case 'text':
      return (
        <>
          <TextColorField note={false} value={styles.text} set={(p) => write((s) => void Object.assign(s.text, p))} />
          <TextColorField note value={styles.note} set={(p) => write((s) => void Object.assign(s.note, p))} />
          <Heading>New notes</Heading>
          <SizeField {...NOTE_SIZE} value={styles.note} onChange={(p) => write((s) => void Object.assign(s.note, p))} />
        </>
      )
  }
}
