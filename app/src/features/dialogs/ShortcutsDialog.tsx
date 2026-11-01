import { shortcutHelp } from '../../keyboard/keymap'
import { useUi } from '../../store/uiStore'
import { DialogShell, Overline } from '../../ui'

const GROUPS = shortcutHelp()

export function ShortcutsDialog() {
  const open = useUi((s) => s.dialog === 'shortcuts')
  const closeDialog = useUi((s) => s.closeDialog)
  return (
    <DialogShell open={open} onOpenChange={(o) => !o && closeDialog()} title="Keyboard shortcuts" width={640}>
      <div className="grid grid-cols-2 gap-x-8 gap-y-5 px-5 py-5 max-sm:grid-cols-1">
        {GROUPS.map(({ group, rows }) => (
          <section key={group}>
            <Overline className="mb-1.5">{group}</Overline>
            {rows.map(({ label, keys }, i) => (
              <div key={i} className="flex items-center justify-between border-b border-line/60 py-1.5 text-[12.5px] text-ink last:border-0">
                {label}
                <span className="flex gap-1">
                  {keys.map((k) => (
                    <kbd key={k}>{k}</kbd>
                  ))}
                </span>
              </div>
            ))}
          </section>
        ))}
      </div>
    </DialogShell>
  )
}
