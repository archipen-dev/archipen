import { ArrowDown, ArrowUp, Check, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { DropdownMenu } from 'radix-ui'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { addPage, deletePage, goToPage, movePage, renamePage } from '../../commands/pages'
import { linksTo } from '../../model/pages'
import type { Page } from '../../model/schema'
import { currentPageId, useDoc } from '../../store/selectors'
import { useUi } from '../../store/uiStore'
import { PAGE_FLOOR_CH, PAGE_MIN_CH } from './fieldWidth'
import { NameInput } from './NameInput'
import { Menu, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tip } from '../../ui'

const pageLabel = (p: Page) => p.name.trim() || 'Untitled page'

/**
 * After the diagram name, like a breadcrumb: "› Page name ▾". The name is renamable while editing; the ▾ opens the
 * page list. Going back up is in the list, or Alt+Left. A one-page diagram shows just the ▾ while editing.
 */
export function PageNav() {
  const doc = useDoc()
  const stack = useUi((s) => s.pageStack)
  const editing = useUi((s) => s.mode === 'edit')
  const current = currentPageId(doc, stack)
  const many = doc.pages.length > 1
  if (!many && !editing) return null
  const page = doc.pages.find((p) => p.id === current) ?? doc.pages[0]
  return (
    <nav aria-label="Pages" className="flex items-center gap-0.5">
      {many && <ChevronRight aria-hidden className="size-3.5 shrink-0 text-ink-faint" />}
      {many &&
        (editing ? (
          <NameInput
            aria-label="Page name"
            aria-current="page"
            value={page.name}
            placeholder="Untitled page"
            onChange={(e) => renamePage(page.id, e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            maxCh={20}
            minCh={PAGE_MIN_CH}
            floorCh={PAGE_FLOOR_CH}
            font="text-[13px] font-medium"
            className="rounded-lg bg-transparent text-ink outline-none placeholder:text-ink-faint hover:bg-chip focus:bg-chip"
          />
        ) : (
          <NameInput asText aria-current="page" value={pageLabel(page)} maxCh={20} minCh={PAGE_MIN_CH} font="text-[13px] font-medium" className="text-ink" />
        ))}
      <PagesMenu current={current} editing={editing} />
    </nav>
  )
}

function PagesMenu({ current, editing }: { current: string; editing: boolean }) {
  const doc = useDoc()
  const remove = (page: Page) => {
    const links = linksTo(doc, page.id).length
    const items = page.nodes.length + page.zones.length + page.edges.length + page.texts.length
    const what = [items && `${items} item${items === 1 ? '' : 's'}`, links && `${links} link${links === 1 ? '' : 's'} to it`].filter(Boolean).join(' and ')
    if (!what || confirm(`Delete the page “${pageLabel(page)}” with ${what}? You can undo this.`)) deletePage(page.id)
  }
  return (
    <Menu
      width={editing ? 'w-72' : 'w-60'}
      align="start"
      trigger={
        <Tip label="Pages">
          <MenuTrigger>
            <button
              aria-label={`Pages (${doc.pages.length})`}
              className="grid h-8 w-5 shrink-0 place-items-center rounded-md text-ink-muted hover:bg-chip hover:text-ink data-[state=open]:bg-chip data-[state=open]:text-ink"
            >
              <ChevronDown className="size-3.5" />
            </button>
          </MenuTrigger>
        </Tip>
      }
    >
      <MenuLabel>Pages</MenuLabel>
      {doc.pages.map((p, i) => {
        const open = <MenuItem key={p.id} icon={p.id === current ? <Check className="size-4" /> : <span className="block size-4" />} label={pageLabel(p)} onSelect={() => goToPage(p.id)} />
        if (!editing) return open
        const name = pageLabel(p)
        return (
          <div key={p.id} className="flex items-center">
            <div className="min-w-0 flex-1">{open}</div>
            <RowAction label={`Move ${name} up`} disabled={i === 0} onSelect={() => movePage(p.id, -1)} icon={<ArrowUp className="size-3.5" />} />
            <RowAction label={`Move ${name} down`} disabled={i === doc.pages.length - 1} onSelect={() => movePage(p.id, 1)} icon={<ArrowDown className="size-3.5" />} />
            <RowAction label={`Delete ${name}`} disabled={doc.pages.length < 2} onSelect={() => remove(p)} icon={<Trash2 className="size-3.5" />} danger />
          </div>
        )
      })}
      {editing && (
        <>
          <MenuSeparator />
          <MenuItem icon={<Plus className="size-4" />} label="Add page" onSelect={() => addPage()} />
        </>
      )}
    </Menu>
  )
}

/** A small icon action at the end of a page row. Its own menu item, so arrow keys reach it; moving keeps the menu open. */
function RowAction({ label, icon, disabled, danger, onSelect }: { label: string; icon: ReactNode; disabled: boolean; danger?: boolean; onSelect: () => void }) {
  return (
    <Tip label={label}>
      <DropdownMenu.Item
        aria-label={label}
        disabled={disabled}
        onSelect={(e) => {
          if (!danger) e.preventDefault()
          onSelect()
        }}
        className={cx(
          'grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-muted outline-none data-[disabled]:cursor-default data-[disabled]:opacity-30 data-[highlighted]:bg-chip data-[highlighted]:text-ink',
          danger && 'data-[highlighted]:text-red-500',
        )}
      >
        {icon}
      </DropdownMenu.Item>
    </Tip>
  )
}
