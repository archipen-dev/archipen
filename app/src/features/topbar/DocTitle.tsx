import { Link } from '@tanstack/react-router'
import { renameDoc } from '../../commands/document'
import { useDoc } from '../../store/selectors'
import { useUi } from '../../store/uiStore'
import { Divider, Logo, Tip } from '../../ui'
import { NameInput } from './NameInput'
import { PageNav } from './PageNav'

/** Logo (back to all diagrams), the editable name and the pages. Whether the file is saved shows on the Save button. */
export function DocTitle({ shared }: { shared: boolean }) {
  const doc = useDoc()
  const name = doc.name
  const many = doc.pages.length > 1
  const readOnly = useUi((s) => s.mode === 'view')
  return (
    <div className="ap-float pointer-events-auto flex h-[52px] items-center gap-1 rounded-2xl pr-3 pl-1.5 text-[16px]">
      <Tip label="All diagrams">
        <Link to="/" className="grid size-[38px] place-items-center rounded-xl text-ink hover:bg-chip">
          <Logo className="size-[26px]" />
        </Link>
      </Tip>
      <Divider />
      <NameInput
        aria-label="Diagram name"
        value={name}
        onChange={(e) => renameDoc(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        readOnly={readOnly}
        maxCh={many ? 22 : 30}
        font="font-display text-[14.5px] font-semibold tracking-tight"
        className="rounded-lg bg-transparent text-ink outline-none hover:bg-chip focus:bg-chip"
      />
      <PageNav />
      {shared && <span className="shrink-0 rounded-md bg-chip px-1.5 py-0.5 text-[10.5px] font-semibold tracking-wide text-ink-muted uppercase">Shared</span>}
    </div>
  )
}
