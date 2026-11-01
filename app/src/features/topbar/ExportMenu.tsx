import { Download, FileImage, FileText, Image as ImageIcon, Sparkles } from 'lucide-react'
import { Fragment, type ReactNode } from 'react'
import type { ExportKind } from '../../io/exporters'
import { usePrefs } from '../../store/prefsStore'
import { Button, Menu, MenuItem, MenuLabel, MenuRadioGroup, MenuSeparator, MenuTrigger, Tip } from '../../ui'
import { useDoc } from '../../store/selectors'
import { useEditorActions } from '../editor/EditorActions'

const icon = (I: typeof FileImage) => <I className="size-4" />

/** Menu entries per group; the exporters themselves live in io/exporters. */
const GROUPS: { label: string; items: { kind: ExportKind; label: string; hint?: string; icon: ReactNode }[] }[] = [
  {
    label: 'Vector',
    items: [
      { kind: 'svg', label: 'SVG', hint: 'font embedded', icon: icon(FileImage) },
      { kind: 'svg-animated', label: 'SVG', hint: 'animated flow', icon: icon(Sparkles) },
      { kind: 'svg-small', label: 'SVG', hint: 'small, no font', icon: icon(FileImage) },
      { kind: 'pdf', label: 'PDF', icon: icon(FileText) },
    ],
  },
  {
    label: 'Image',
    items: [
      { kind: 'png-2x', label: 'PNG', hint: '2×', icon: icon(ImageIcon) },
      { kind: 'png-3x', label: 'PNG', hint: '3×', icon: icon(ImageIcon) },
      { kind: 'png-transparent', label: 'PNG', hint: 'transparent', icon: icon(ImageIcon) },
    ],
  },
]

export function ExportMenu() {
  const { exportFile } = useEditorActions()
  const pages = useDoc().pages.length
  const scope = usePrefs((s) => s.exportPages)
  const setPrefs = usePrefs((s) => s.setPrefs)
  // PNG is always one page; SVG and PDF follow the choice.
  const hint = (it: (typeof GROUPS)[number]['items'][number]) => {
    if (pages < 2) return it.hint
    if (it.kind.startsWith('png')) return it.hint ? `${it.hint}, this page` : 'this page'
    if (scope === 'all' && it.kind.startsWith('svg')) return it.hint ? `${it.hint}, clickable` : 'clickable'
    return it.hint
  }
  return (
    <Menu
      trigger={
        <Tip label="Export">
          <MenuTrigger>
            <Button size="bar" aria-label="Export" disabled={exportFile.isPending}>
              <Download className="size-[19px]" />
            </Button>
          </MenuTrigger>
        </Tip>
      }
    >
      {pages > 1 && (
        <>
          <MenuLabel>Pages</MenuLabel>
          <MenuRadioGroup
            label="Pages to export"
            value={scope}
            options={[
              { value: 'all', label: `All ${pages} pages` },
              { value: 'current', label: 'This page' },
            ]}
            onChange={(exportPages) => setPrefs({ exportPages })}
          />
          <MenuSeparator />
        </>
      )}
      {GROUPS.map((g, i) => (
        <Fragment key={g.label}>
          {i > 0 && <MenuSeparator />}
          <MenuLabel>{g.label}</MenuLabel>
          {g.items.map((it) => (
            <MenuItem key={it.kind} icon={it.icon} label={it.label} hint={hint(it)} onSelect={() => exportFile.mutate(it.kind)} />
          ))}
        </Fragment>
      ))}
    </Menu>
  )
}
