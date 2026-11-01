import { resolveText } from '../../../model/defaults'
import type { Doc, TextData, TextStyle } from '../../../model/schema'
import { Field, Segmented } from '../../../ui'
import { NOTE_SIZE, SizeField, TextColorField } from '../../style-fields'
import { patchItem, styleOps } from '../styleOps'
import { SavedSection } from '../SavedSection'

export function TextAppearance({ t, doc }: { t: TextData; doc: Doc }) {
  const note = t.kind === 'note'
  return (
    <SavedSection id="props.appearance" title="Appearance">
      <Field label="Kind">
        <Segmented
          size="sm"
          className="w-full"
          value={t.kind}
          // Text and note colours come from different palettes, so the colour resets.
          onChange={(kind) => patchItem<TextData>(t.id, { kind, color: undefined })}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'note', label: 'Sticky note' },
          ]}
        />
      </Field>
      <TextColorField note={note} value={resolveText(doc.settings.styles, t)} over={note && t.color === '' ? {} : t} {...styleOps<TextStyle>(t.id)} />
      {note && <SizeField {...NOTE_SIZE} value={t} onChange={(p) => patchItem<TextData>(t.id, p)} />}
    </SavedSection>
  )
}
