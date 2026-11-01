import { RotateCcw } from 'lucide-react'
import { useState } from 'react'
import { clearKindOverrides, restoreKindDefaults, setCrossing, setGrid, setLabelDefaults } from '../../commands/document'
import { cx } from '../../lib/cx'
import { itemsOf } from '../../model/entities'
import { ENTITY_KINDS, KIND_META } from '../../model/kinds'
import type { Doc, EntityKind } from '../../model/schema'
import { hasOverrides } from '../../model/styles'
import { usePrefs } from '../../store/prefsStore'
import { useDocStore } from '../../store/docStore'
import { useUi } from '../../store/uiStore'
import { Button, DialogShell, Field, Overline, Segmented, Switch } from '../../ui'
import { LabelEditor } from '../style-fields'
import { Heading, StyleDefaultsEditor } from './StyleDefaultsEditor'

export function SettingsDialog() {
  const open = useUi((s) => s.dialog === 'settings')
  const closeDialog = useUi((s) => s.closeDialog)
  const doc = useDocStore((s) => s.doc)
  if (!doc) return null
  return (
    <DialogShell open={open} onOpenChange={(o) => !o && closeDialog()} title="Settings" width={720}>
      <div className="space-y-6 px-5 py-5">
        <PreferencesSection />
        <CanvasSection doc={doc} />
        <DefaultsSection doc={doc} />
      </div>
    </DialogShell>
  )
}

/** Per-person settings, kept in this browser. */
function PreferencesSection() {
  const { theme, setPrefs } = usePrefs()
  return (
    <section>
      <Overline className="mb-2">You</Overline>
      <div className="max-w-[360px]">
        <Field label="Theme">
          <Segmented
            value={theme}
            onChange={(theme) => setPrefs({ theme })}
            options={[
              { value: 'system', label: 'System' },
              { value: 'light', label: 'Light' },
              { value: 'dark', label: 'Dark' },
            ]}
          />
        </Field>
      </div>
    </section>
  )
}

/** How this diagram draws its canvas. */
function CanvasSection({ doc }: { doc: Doc }) {
  return (
    <section>
      <Overline className="mb-2">Canvas · this diagram</Overline>
      <div className="max-w-[360px]">
        <Field label="Crossings" hint="How wires show where they cross.">
          <Segmented
            value={doc.settings.crossing}
            onChange={setCrossing}
            options={[
              { value: 'hop', label: 'Hop' },
              { value: 'gap', label: 'Gap' },
              { value: 'none', label: 'None' },
            ]}
          />
        </Field>
        <Field label="Grid">
          <Switch checked={doc.settings.grid} onChange={setGrid} />
        </Field>
      </div>
    </section>
  )
}

/** This diagram's style and label defaults, one tab per kind of item. */
function DefaultsSection({ doc }: { doc: Doc }) {
  const [kind, setKind] = useState<EntityKind>('node')
  return (
    <section>
      <div className="mb-1 flex items-center justify-between">
        <Overline>Defaults · this diagram</Overline>
        <Button size="sm" onClick={() => restoreKindDefaults(kind)} title={`Restore the built-in defaults for ${KIND_META[kind].plural}`}>
          <RotateCcw className="size-3" /> Restore
        </Button>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">Every item follows these unless it sets its own value; overrides show a dot in the item&rsquo;s panel.</p>
      <KindTabs value={kind} onChange={setKind} />
      <div className="grid gap-x-8 gap-y-5 sm:grid-cols-2">
        <div className="min-w-0">
          <Heading>Style</Heading>
          <StyleDefaultsEditor kind={kind} styles={doc.settings.styles} />
        </div>
        <div className="min-w-0">
          <Heading>Label</Heading>
          <LabelEditor value={doc.settings.labelDefaults[kind]} onChange={(p) => setLabelDefaults(kind, p)} />
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            {kind === 'edge'
              ? 'For connections, any direction other than “facing the screen” makes the label follow the wire.'
              : 'Side is relative to the text direction: with a flat-on-the-ground label, “top” is the far edge along that axis.'}
          </p>
        </div>
      </div>
      <OverridesNotice doc={doc} kind={kind} />
    </section>
  )
}

function KindTabs({ value, onChange }: { value: EntityKind; onChange: (k: EntityKind) => void }) {
  return (
    <div className="mb-4 flex gap-1 border-b border-line">
      {ENTITY_KINDS.map((k) => (
        <button
          key={k}
          onClick={() => onChange(k)}
          className={cx('-mb-px border-b-2 px-2.5 pb-2 text-[12.5px] font-medium transition-colors', value === k ? 'border-accent text-ink' : 'border-transparent text-ink-muted hover:text-ink')}
        >
          {KIND_META[k].tab}
        </button>
      ))}
    </div>
  )
}

/** How many items of this kind ignore the defaults, with a way to make them follow again. */
function OverridesNotice({ doc, kind }: { doc: Doc; kind: EntityKind }) {
  const count = doc.pages.flatMap((p) => itemsOf(p, kind)).filter((it) => hasOverrides(it, kind)).length
  if (!count) return null
  const meta = KIND_META[kind]
  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl bg-chip px-3.5 py-2.5">
      <span className="size-1.5 shrink-0 rounded-full bg-accent" />
      <p className="flex-1 text-[12px] leading-snug text-ink-muted">
        <span className="font-medium text-ink">
          {count} {count === 1 ? meta.one : meta.plural}
        </span>{' '}
        {count === 1 ? 'has' : 'have'} their own style or label settings, which take priority over these defaults.
      </p>
      <Button size="sm" variant="subtle" onClick={() => clearKindOverrides(kind)}>
        Clear overrides
      </Button>
    </div>
  )
}
