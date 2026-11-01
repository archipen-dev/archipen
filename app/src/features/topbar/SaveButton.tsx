import { Check, ChevronDown, Download } from 'lucide-react'
import { cx } from '../../lib/cx'
import { shortcut } from '../../keyboard/keys'
import { useIsDirty } from '../../store/selectors'
import { Menu, MenuItem, MenuTrigger, Tip } from '../../ui'
import { useEditorActions } from '../editor/EditorActions'

/**
 * Save (with a Save as… menu), or for a shared diagram, Save a copy. The button shows whether the file on disk is up to
 * date: a dark "Save" while there are changes only autosaved in this browser, a quiet "Saved" once they're written.
 */
export function SaveButton() {
  const { save, saveCopy, shared } = useEditorActions()
  const dirty = useIsDirty()
  if (shared)
    return (
      <button
        onClick={() => saveCopy.mutate()}
        disabled={saveCopy.isPending}
        className="ml-1 h-[38px] rounded-xl bg-ink px-3.5 text-[12.5px] font-semibold text-paper hover:opacity-90 disabled:opacity-50"
      >
        Save a copy
      </button>
    )
  return (
    <div className={cx('ml-1 flex h-[38px] items-center overflow-hidden rounded-xl transition-colors', dirty ? 'bg-ink text-paper' : 'bg-chip text-ink-muted')}>
      <Tip label={dirty ? 'Unsaved changes, kept in this browser. Save to disk' : 'Everything is saved to disk'} keys={shortcut('Mod+S')}>
        <button
          onClick={() => save.mutate(false)}
          disabled={save.isPending}
          className={cx('flex h-full items-center gap-1 pr-2 pl-3.5 text-[12.5px] font-semibold disabled:opacity-50', dirty ? 'hover:bg-white/10' : 'pl-2.5 hover:bg-chip-hover hover:text-ink')}
        >
          {!dirty && <Check aria-hidden className="size-3.5" />}
          {dirty ? 'Save' : 'Saved'}
        </button>
      </Tip>
      <Menu
        width="w-52"
        sideOffset={14}
        trigger={
          <Tip label="More save options">
            <MenuTrigger>
              <button className={cx('grid h-full w-7 place-items-center border-l', dirty ? 'border-white/15 hover:bg-white/10' : 'border-line hover:bg-chip-hover hover:text-ink')}>
                <ChevronDown className="size-3.5 opacity-70" />
              </button>
            </MenuTrigger>
          </Tip>
        }
      >
        <MenuItem icon={<Download className="size-4" />} label="Save" hint={shortcut('Mod+S')} onSelect={() => save.mutate(false)} />
        <MenuItem icon={<Download className="size-4" />} label="Save as…" hint={shortcut('Mod+Shift+S')} onSelect={() => save.mutate(true)} />
      </Menu>
    </div>
  )
}
