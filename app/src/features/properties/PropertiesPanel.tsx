import { findEntity } from '../../model/entities'
import { useDoc } from '../../store/selectors'
import { useUi } from '../../store/uiStore'
import { EntityPanel } from './EntityPanel'
import { MultiSelectionPanel } from './MultiSelectionPanel'

/** The edit-mode side panel: picks the panel for the current selection. */
export function PropertiesPanel() {
  const doc = useDoc()
  const selection = useUi((s) => s.selection)
  if (selection.length > 1) return <MultiSelectionPanel ids={selection} />
  const ent = selection.length ? findEntity(doc, selection[0]) : null
  return ent ? <EntityPanel doc={doc} ent={ent} /> : null
}
