import { useEffect, useRef, useState } from 'react'
import { renameEntity } from '../../commands/entity'
import { entityBounds } from '../../geometry/hit'
import type { Scene } from '../../geometry/scene'
import { findEntity } from '../../model/entities'
import { useDoc } from '../../store/selectors'
import { useUi, type Viewport } from '../../store/uiStore'

/** Floating text field for renaming an item in place. */
export function InlineEditor({ id, scene, viewport }: { id: string; scene: Scene; viewport: Viewport }) {
  const entity = findEntity(useDoc(), id)
  const [value, setValue] = useState(entity?.item.name ?? '')
  const ref = useRef<HTMLTextAreaElement>(null)
  const done = useRef(false)

  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])

  const b = entity && entityBounds(scene, id)
  if (!entity || !b) return null
  const cx = viewport.x + (b.x + b.w / 2) * viewport.zoom
  const cy = viewport.y + (b.y + b.h / 2) * viewport.zoom
  const multiline = entity.kind === 'text'

  const finish = (save: boolean) => {
    if (done.current) return
    done.current = true
    if (save && value !== entity.item.name) renameEntity(id, value.trim())
    useUi.getState().setEditing(null)
  }

  return (
    <div className="absolute z-20" style={{ left: cx, top: cy, transform: 'translate(-50%, -50%)' }} onPointerDown={(e) => e.stopPropagation()}>
      <textarea
        ref={ref}
        value={value}
        rows={multiline ? Math.max(1, value.split('\n').length) : 1}
        onChange={(e) => setValue(e.target.value)}
        onBlur={() => finish(true)}
        onKeyDown={(e) => {
          e.stopPropagation()
          if (e.key === 'Escape') finish(false)
          if (e.key === 'Enter' && (!multiline || e.metaKey || e.ctrlKey || !e.shiftKey)) {
            e.preventDefault()
            finish(true)
          }
        }}
        placeholder="Name"
        className="ap-inline-edit"
        style={{ width: Math.max(160, Math.min(360, value.length * 9 + 40)) }}
      />
    </div>
  )
}
