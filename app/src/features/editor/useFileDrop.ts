import { useState, type DragEvent } from 'react'
import { addIconNodes } from '../../commands/create'
import { importSvgIcons, isSvgFile } from '../../commands/icons'
import { snap, unproject } from '../../geometry/projection'
import { screenToScene } from '../../geometry/viewport'
import { readDiagramFile } from '../../io/fileIO'
import { getDoc } from '../../store/selectors'
import { toast } from '../../store/toastStore'
import { useUi } from '../../store/uiStore'
import { reportError, useOpenDocument } from '../documents'

const isJson = (f: File) => f.name.toLowerCase().endsWith('.json')

/**
 * Drop a .json diagram to open it, or SVG files to add them as icon nodes where they land (edit mode only).
 */
export function useFileDrop({ canEdit }: { canEdit: boolean }) {
  const [dragging, setDragging] = useState(false)
  const openDocument = useOpenDocument()

  const dropIcons = async (files: File[], e: DragEvent) => {
    const icons = await importSvgIcons(files)
    if (!icons.length) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ui = useUi.getState()
    const sp = screenToScene(ui.viewport, { x: e.clientX - rect.left, y: e.clientY - rect.top })
    const w = unproject(sp.x, sp.y, getDoc()!.settings.projection)
    ui.select(addIconNodes(icons, snap(w.x, 1), snap(w.y, 1)))
    toast(`Added ${icons.length} icon${icons.length > 1 ? 's' : ''}`)
  }

  const onDrop = async (e: DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const json = files.find(isJson)
    if (json) {
      try {
        await openDocument(await readDiagramFile(json), { dirty: false, mode: useUi.getState().mode })
      } catch (err) {
        reportError(err)
      }
      return
    }
    const svgs = files.filter(isSvgFile)
    if (svgs.length && canEdit && useUi.getState().mode === 'edit') await dropIcons(svgs, e)
  }

  const handlers = {
    onDragOver: (e: DragEvent) => {
      if (!e.dataTransfer.types.includes('Files')) return
      e.preventDefault()
      setDragging(true)
    },
    onDragLeave: (e: DragEvent) => e.currentTarget === e.target && setDragging(false),
    onDrop,
  }
  return { dragging, handlers }
}
