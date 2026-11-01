import { Eye, EyeOff, Lock, LockOpen, Trash2 } from 'lucide-react'
import { deleteIds, toggleFlag } from '../../commands/edit'
import { findEntities } from '../../model/entities'
import { shortcut } from '../../keyboard/keys'
import { useDoc } from '../../store/selectors'
import { Button } from '../../ui'

/** Lock, hide and delete, pinned at the foot of an item panel. */
export function ItemActions({ ids }: { ids: string[] }) {
  const items = findEntities(useDoc(), ids).map((e) => e.item)
  const locked = items.length > 0 && items.every((it) => it.locked)
  const hidden = items.length > 0 && items.every((it) => it.hidden)
  return (
    <div className="space-y-1.5 p-3">
      <div className="grid grid-cols-2 gap-1.5">
        <Button
          variant={locked ? 'ghost' : 'subtle'}
          active={locked}
          aria-pressed={locked}
          title={`Locked items can be selected but not moved or resized (${shortcut('Mod+Shift+L')})`}
          onClick={() => toggleFlag(ids, 'locked')}
        >
          {locked ? <Lock className="size-3.5" /> : <LockOpen className="size-3.5" />}
          {locked ? 'Unlock' : 'Lock'}
        </Button>
        <Button
          variant={hidden ? 'ghost' : 'subtle'}
          active={hidden}
          aria-pressed={hidden}
          title={`Hidden items aren't drawn anywhere, including exports (${shortcut('Mod+Shift+H')})`}
          onClick={() => toggleFlag(ids, 'hidden')}
        >
          {hidden ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
          {hidden ? 'Show' : 'Hide'}
        </Button>
      </div>
      <Button variant="danger" className="w-full" title="Delete (Del)" onClick={() => deleteIds(ids)}>
        <Trash2 className="size-3.5" />
        Delete{ids.length > 1 ? ` ${ids.length} items` : ''}
      </Button>
    </div>
  )
}
