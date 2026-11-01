import { resolveNode } from '../../../model/defaults'
import { NODE_STYLE_KEYS, type Doc, type NodeData, type NodeStyle } from '../../../model/schema'
import { customCount } from '../../../model/styles'
import { Field } from '../../../ui'
import { IconPicker } from '../../icon-picker'
import { NODE_SIZE, NodeIconFields, NodeLookFields, NodeShapeField, SizeField } from '../../style-fields'
import { StyleBadge } from '../StyleBadge'
import { patchItem, resetKeys, styleOps } from '../styleOps'
import { SavedSection } from '../SavedSection'

export function NodeAppearance({ n, doc }: { n: NodeData; doc: Doc }) {
  const fields = { value: resolveNode(doc.settings.styles, n) as NodeStyle, over: n as Partial<NodeStyle>, ...styleOps<NodeStyle>(n.id) }
  return (
    <SavedSection
      id="props.appearance"
      title="Appearance"
      aside={<StyleBadge count={customCount(n, NODE_STYLE_KEYS)} onReset={() => resetKeys<NodeData>(n.id, NODE_STYLE_KEYS)} />}
    >
      <NodeShapeField {...fields} />
      <NodeLookFields {...fields} />
      <SizeField {...NODE_SIZE} value={n} onChange={(p) => patchItem<NodeData>(n.id, p)} />
      <Field label="Icon">
        <IconPicker value={n.icon} onChange={(icon) => patchItem<NodeData>(n.id, { icon })} />
      </Field>
      {n.icon && <NodeIconFields {...fields} custom={n.icon.startsWith('custom:')} />}
    </SavedSection>
  )
}
