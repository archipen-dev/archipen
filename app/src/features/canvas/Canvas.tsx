import { useEffect, useMemo, useRef, useState } from 'react'
import { createSceneBuilder } from '../../geometry/scene'
import { visibleRect } from '../../geometry/viewport'
import { focusSet } from '../../model/focus'
import { lockedIds } from '../../model/visibility'
import { describeScene } from '../../render/describe'
import { a11yElementId, RenderModeContext, type RenderMode } from '../../render/mode'
import { SceneView } from '../../render/Scene'
import { useGestureOpen, usePage, usePageNames } from '../../store/selectors'
import { useCanvasTheme } from '../../store/theme'
import { useUi } from '../../store/uiStore'
import { canvasCursor } from './cursor'
import { EmptyState } from './EmptyState'
import { Grid } from './Grid'
import { InlineEditor } from './InlineEditor'
import { Overlay } from './Overlay'
import { useCanvasSize } from './useCanvasSize'
import { useEditAnnouncement } from './useEditAnnouncement'
import { useGestures } from './useGestures'
import { useWheelNavigation } from './useWheelNavigation'

/** The diagram surface: draws the scene and turns pointer input into edits. */
export function Canvas() {
  const doc = usePage()
  const pageNames = usePageNames()
  const viewport = useUi((s) => s.viewport)
  const size = useUi((s) => s.canvasSize)
  const tool = useUi((s) => s.tool)
  const mode = useUi((s) => s.mode)
  const selection = useUi((s) => s.selection)
  const hoverId = useUi((s) => s.hoverId)
  const spaceDown = useUi((s) => s.spaceDown)
  const editingId = useUi((s) => s.editingId)
  // Presenting shows the bare diagram; a click focuses an item instead of selecting it.
  const bare = useUi((s) => s.presenting)
  const theme = useCanvasTheme()
  const projection = doc.settings.projection
  // While a drag is open, only the wires it can affect are routed again; the drop routes everything.
  const dragging = useGestureOpen()
  const [builder] = useState(createSceneBuilder)
  const scene = useMemo(() => builder.build(doc, projection, { incremental: dragging }), [builder, doc, projection, dragging])
  const focus = useMemo(() => (bare && selection.length ? focusSet(doc, selection) : null), [bare, selection, doc])
  // Screen readers: every item is named, the selected one is the active descendant, edits are announced.
  const described = useMemo(() => describeScene(scene, pageNames), [scene, pageNames])
  const renderMode = useMemo<RenderMode>(() => ({ bare: false, a11y: described.items }), [described])
  const announcement = useEditAnnouncement(doc.id, { id: doc.pageId, name: doc.pageName }, described.items)
  const active = selection.length === 1 && described.items.has(selection[0]) ? a11yElementId(selection[0]) : undefined

  const containerRef = useRef<HTMLDivElement>(null)
  useCanvasSize(containerRef)
  useWheelNavigation(containerRef)
  const { preview, panning, handlers } = useGestures(containerRef, scene, projection)
  // Keyboard focus lives on the canvas: take it on a click, and get it back when inline renaming ends.
  // A click must not draw the keyboard focus ring. `focusVisible: false` says so where supported;
  // the data attribute hides the ring elsewhere until the next key press.
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    handlers.onPointerDown(e)
    const el = containerRef.current
    if (e.button === 2 || !el) return
    el.dataset.pointerFocus = ''
    const opts: FocusOptions & { focusVisible?: boolean } = { preventScroll: true, focusVisible: false }
    el.focus(opts)
  }
  const clearPointerFocus = () => {
    delete containerRef.current?.dataset.pointerFocus
  }
  const wasEditing = useRef(false)
  useEffect(() => {
    if (wasEditing.current && !editingId && document.activeElement === document.body) containerRef.current?.focus({ preventScroll: true })
    wasEditing.current = !!editingId
  }, [editingId])

  const selectionLocked = useMemo(() => selection.length === 1 && lockedIds(doc).has(selection[0]), [doc, selection])

  const v = viewport
  const editing = mode === 'edit'
  const empty = !doc.nodes.length && !doc.zones.length && !doc.texts.length
  const cursor = canvasCursor({ panning, spaceDown, tool, mode, hovering: !!hoverId })

  return (
    <div
      ref={containerRef}
      data-canvas
      tabIndex={0}
      role="application"
      aria-roledescription="diagram"
      aria-label={pageNames.size > 1 ? `${doc.name || 'Untitled diagram'}, page ${doc.pageName || 'Untitled page'}` : doc.name || 'Untitled diagram'}
      aria-describedby="ap-canvas-summary"
      aria-activedescendant={active}
      className="absolute inset-0 overflow-hidden select-none touch-none outline-none [&:not([data-pointer-focus]):focus-visible]:ring-2 [&:not([data-pointer-focus]):focus-visible]:ring-inset [&:not([data-pointer-focus]):focus-visible]:ring-accent/50"
      style={{ background: theme.bg, cursor }}
      {...handlers}
      onPointerDown={onPointerDown}
      onKeyDown={clearPointerFocus}
      onBlur={clearPointerFocus}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div id="ap-canvas-summary" className="sr-only">
        {described.summary} Tab and Shift+Tab move between items. Press ? for all shortcuts.
      </div>
      <div className="sr-only" aria-live="polite">
        {announcement}
      </div>
      {/* A single selected item is read as the active descendant; several are counted. */}
      <div className="sr-only" aria-live="polite">
        {selection.length > 1 ? `${selection.length} items selected` : ''}
      </div>
      <svg width="100%" height="100%" className="block">
        <g transform={`translate(${v.x} ${v.y}) scale(${v.zoom})`}>
          {doc.settings.grid && <Grid projection={projection} zoom={v.zoom} visible={visibleRect(v, size)} color={theme.grid} axis={theme.gridAxis} />}
          <RenderModeContext.Provider value={renderMode}>
            <SceneView scene={scene} assets={doc.assets} theme={theme} focus={focus} />
          </RenderModeContext.Provider>
          {!bare && (
            <Overlay
              scene={scene}
              accent={theme.accent}
              zoom={v.zoom}
              selection={selection}
              hoverId={hoverId}
              editing={editing}
              selectionLocked={selectionLocked}
              showPorts={editing && (tool === 'select' || tool === 'connect') && !panning}
              preview={preview}
            />
          )}
        </g>
      </svg>
      {editingId && <InlineEditor id={editingId} scene={scene} viewport={v} />}
      {empty && editing && <EmptyState />}
    </div>
  )
}
