import { useMemo } from 'react'
import { TEMPLATES, templateDoc, type Template } from '../../model/templates'
import { DiagramPreview } from './DiagramPreview'
import { HomeSection, Thumb } from './HomeSection'

export function TemplateGrid({ onPick }: { onPick: (t: Template) => void }) {
  const templates = useMemo(() => TEMPLATES.map((t) => ({ t, doc: templateDoc(t) })), [])
  return (
    <HomeSection title="Start from a template" note="Opens an editable copy" label="Templates">
      <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-4">
        {templates.map(({ t, doc }, i) => (
          <button
            key={t.id}
            onClick={() => onPick(t)}
            style={{ animationDelay: `${i * 40}ms` }}
            className="ap-enter group overflow-hidden rounded-2xl border border-line bg-panel text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-float focus-visible:ring-2 focus-visible:ring-accent/50 focus-visible:outline-none"
          >
            <Thumb>
              <DiagramPreview doc={doc} pad={12} />
            </Thumb>
            <div className="px-3.5 py-3">
              <div className="truncate text-[13.5px] font-semibold group-hover:text-accent">{t.name}</div>
              <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-ink-faint">{t.description}</div>
            </div>
          </button>
        ))}
      </div>
    </HomeSection>
  )
}
