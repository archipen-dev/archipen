import { ArrowRight, Plus } from 'lucide-react'
import { addLinkedPage, openPage, setLink } from '../../../commands/pages'
import type { NodeData, ZoneData } from '../../../model/schema'
import { modifier } from '../../../keyboard/keys'
import { currentPageId, useDoc } from '../../../store/selectors'
import { Button, Field, Select } from '../../../ui'
import { SavedSection } from '../SavedSection'

const NONE = ''

/** Link a node or zone to another page, for drill-down in view and present mode. */
export function LinkSection({ item }: { item: NodeData | ZoneData }) {
  const doc = useDoc()
  const here = currentPageId(doc)
  const target = item.link?.page ?? NONE
  const linked = target !== NONE && doc.pages.some((p) => p.id === target)
  const options = [
    { value: NONE, label: 'None' },
    ...doc.pages.filter((p) => p.id !== here).map((p) => ({ value: p.id, label: p.name.trim() || 'Untitled page' })),
    ...(target !== NONE && !linked ? [{ value: target, label: `Missing page “${target}”` }] : []),
  ]
  return (
    <SavedSection id="props.link" title="Link">
      <Field label="Opens page" hint={linked ? `${modifier('Mod')}-click it on the canvas to open; in present mode a plain click does.` : undefined}>
        <Select value={target} options={options} onChange={(v) => setLink(item.id, v || null)} />
      </Field>
      <div className="mt-1.5 flex gap-1.5">
        {linked ? (
          <Button variant="subtle" className="flex-1" onClick={() => openPage(target)}>
            <ArrowRight className="size-3.5" /> Open page
          </Button>
        ) : (
          <Button variant="subtle" className="flex-1" onClick={() => addLinkedPage(item.id, item.name)}>
            <Plus className="size-3.5" /> New linked page
          </Button>
        )}
      </div>
    </SavedSection>
  )
}
