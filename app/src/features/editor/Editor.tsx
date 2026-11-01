import { AiConnectDialog, SettingsDialog, ShortcutsDialog } from '../dialogs'
import { Canvas } from '../canvas'
import { DetailsPanel } from '../details'
import { PropertiesPanel } from '../properties'
import { TopBar } from '../topbar'
import { Toolbar, ZoomControls } from '../toolbar'
import { useAutosave } from '../../io/useAutosave'
import { useDoc } from '../../store/selectors'
import { hasSidePanel, useUi } from '../../store/uiStore'
import { DropOverlay, PresentHint, ReadOnlyBadge } from './Badges'
import { EditorActionsProvider } from './EditorActions'
import { useFileDrop } from './useFileDrop'
import { useLeaveGuard } from './useLeaveGuard'
import { useFitOnOpen } from './usePresentation'

/** The diagram editor/viewer screen, shared by `/d/$docId` and `/share`. */
export function Editor({ shared = false }: { shared?: boolean }) {
  return (
    <EditorActionsProvider shared={shared}>
      <EditorScreen shared={shared} />
    </EditorActionsProvider>
  )
}

function EditorScreen({ shared }: { shared: boolean }) {
  const docId = useDoc().id
  const presenting = useUi((s) => s.presenting)
  const viewing = useUi((s) => s.mode === 'view')
  const { dragging, handlers } = useFileDrop({ canEdit: !shared })
  useFitOnOpen(docId)
  useAutosave()
  useLeaveGuard()

  return (
    <div className="relative h-full w-full overflow-hidden" {...handlers}>
      <Canvas />
      {presenting ? <PresentHint /> : <EditorChrome />}
      <SettingsDialog />
      <ShortcutsDialog />
      <AiConnectDialog />
      {dragging && <DropOverlay />}
      {viewing && !presenting && <ReadOnlyBadge />}
    </div>
  )
}

/** Bars and panels around the canvas. Edit mode shows the properties panel, view mode the read-only details. */
function EditorChrome() {
  const mode = useUi((s) => s.mode)
  const showPanel = useUi(hasSidePanel)
  return (
    <>
      <TopBar />
      <Toolbar />
      <ZoomControls />
      {showPanel && (mode === 'edit' ? <PropertiesPanel /> : <DetailsPanel />)}
    </>
  )
}
