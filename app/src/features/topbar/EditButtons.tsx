import { Redo2, Undo2 } from 'lucide-react'
import { history } from '../../commands/mutate'
import { shortcut } from '../../keyboard/keys'
import { useCanRedo, useCanUndo } from '../../store/selectors'
import { Button, Divider, Tip } from '../../ui'
import { FlaggedMenu } from './FlaggedMenu'

/** Undo, redo and the locked & hidden list (edit mode). */
export function EditButtons() {
  const canUndo = useCanUndo()
  const canRedo = useCanRedo()
  return (
    <>
      <Tip label="Undo" keys={shortcut('Mod+Z')}>
        <Button size="bar" disabled={!canUndo} onClick={history.undo}>
          <Undo2 className="size-[19px]" />
        </Button>
      </Tip>
      <Tip label="Redo" keys={shortcut('Mod+Shift+Z')}>
        <Button size="bar" disabled={!canRedo} onClick={history.redo}>
          <Redo2 className="size-[19px]" />
        </Button>
      </Tip>
      <FlaggedMenu />
      <Divider />
    </>
  )
}
