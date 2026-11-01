import { FolderOpen, Keyboard, Presentation, Settings } from 'lucide-react'
import { shortcut } from '../../keyboard/keys'
import { useUi } from '../../store/uiStore'
import { Button, Tip } from '../../ui'
import { useEditorActions } from '../editor/EditorActions'
import { AiStatus } from './AiStatus'
import { DocTitle } from './DocTitle'
import { EditButtons } from './EditButtons'
import { ExportMenu } from './ExportMenu'
import { SaveButton } from './SaveButton'
import { ShareMenu } from './ShareMenu'
import { ViewSwitches } from './ViewSwitches'

/** The bar across the top of the editor: document on the left, view switches in the middle, actions on the right. */
export function TopBar() {
  const { open, present, shared } = useEditorActions()
  const editing = useUi((s) => s.mode === 'edit')
  const openDialog = useUi((s) => s.openDialog)
  return (
    <header onPointerDown={(e) => e.stopPropagation()} className="pointer-events-none absolute inset-x-3 top-3 z-20 flex items-start justify-between gap-3">
      <DocTitle shared={shared} />
      <ViewSwitches />
      <div className="ap-float pointer-events-auto flex h-[52px] items-center gap-0.5 rounded-2xl px-1.5">
        <AiStatus />
        {editing && <EditButtons />}
        <Tip label="Present" keys="P">
          <Button size="bar" onClick={present.enter}>
            <Presentation className="size-[19px]" />
          </Button>
        </Tip>
        <ShareMenu />
        <Tip label="Open file" keys={shortcut('Mod+O')}>
          <Button size="bar" onClick={() => open.mutate()}>
            <FolderOpen className="size-4" />
          </Button>
        </Tip>
        <ExportMenu />
        <Tip label="Settings">
          <Button size="bar" onClick={() => openDialog('settings')}>
            <Settings className="size-4" />
          </Button>
        </Tip>
        <Tip label="Keyboard shortcuts" keys="?">
          <Button size="bar" onClick={() => openDialog('shortcuts')}>
            <Keyboard className="size-4" />
          </Button>
        </Tip>
        <SaveButton />
      </div>
    </header>
  )
}
