import type { AnyEntity } from '../../../model/entities'
import { TextArea, TextInput } from '../../../ui'
import { SavedSection } from '../SavedSection'
import { patchItem } from '../styleOps'

/** The item's name, pinned at the top of the panel. */
export function NameField({ ent }: { ent: AnyEntity }) {
  const { id, name } = ent.item
  return (
    <TextInput
      value={name}
      aria-label={ent.kind === 'edge' ? 'Label' : 'Name'}
      placeholder={ent.kind === 'edge' ? 'Label (optional)' : 'Name'}
      onChange={(e) => patchItem(id, { name: e.target.value }, 'name')}
      className="text-[13px] font-semibold"
    />
  )
}

export function DescriptionSection({ ent }: { ent: AnyEntity }) {
  const { id, description } = ent.item
  const text = ent.kind === 'text'
  return (
    <SavedSection id={text ? 'props.body' : 'props.description'} title={text ? 'Body' : 'Description'}>
      <TextArea
        value={description}
        aria-label={text ? 'Body text' : 'Description'}
        placeholder={text ? 'Body text' : 'Description'}
        rows={3}
        onChange={(e) => patchItem(id, { description: e.target.value }, 'desc')}
      />
    </SavedSection>
  )
}
