import { resetEntityLabel, setEntityLabel } from '../../../commands/entity'
import { resolveLabel } from '../../../model/defaults'
import type { AnyEntity } from '../../../model/entities'
import type { Doc } from '../../../model/schema'
import { LabelEditor } from '../../style-fields'
import { CustomTag } from '../StyleBadge'
import { SavedSection } from '../SavedSection'

/** Label placement, over the diagram's label defaults for this kind. */
export function LabelSection({ doc, ent }: { doc: Doc; ent: AnyEntity }) {
  const { id, label } = ent.item
  return (
    <SavedSection id="props.label" title="Label" defaultOpen={false} aside={<CustomTag custom={!!label} />}>
      <LabelEditor value={resolveLabel(doc, ent.kind, label)} override={label} onChange={(p) => setEntityLabel(id, p)} onReset={(k) => resetEntityLabel(id, k)} />
    </SavedSection>
  )
}
