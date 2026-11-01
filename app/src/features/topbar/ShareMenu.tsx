import { Link2 } from 'lucide-react'
import { Button, Menu, MenuItem, MenuLabel, MenuTrigger, Tip } from '../../ui'
import { useEditorActions } from '../editor/EditorActions'

export function ShareMenu() {
  const { share } = useEditorActions()
  return (
    <Menu
      width="w-60"
      trigger={
        <Tip label="Share">
          <MenuTrigger>
            <Button size="bar" aria-label="Share" disabled={share.isPending}>
              <Link2 className="size-[19px]" />
            </Button>
          </MenuTrigger>
        </Tip>
      }
    >
      <MenuLabel>Read-only, nothing uploaded</MenuLabel>
      <MenuItem icon={<Link2 className="size-4" />} label="Copy link" onSelect={() => share.mutate()} />
    </Menu>
  )
}
