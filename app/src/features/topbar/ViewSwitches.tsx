import { setProjection } from '../../commands/document'
import { shortcut } from '../../keyboard/keys'
import { useDoc } from '../../store/selectors'
import { Segmented } from '../../ui'

/** The projection switch. */
export function ViewSwitches() {
  const projection = useDoc().settings.projection
  return (
    <Segmented
      track={false}
      size="lg"
      className="ap-float pointer-events-auto h-[52px] items-center gap-0.5 rounded-2xl px-1.5 max-md:hidden"
      value={projection}
      onChange={setProjection}
      options={[
        { value: 'iso', label: 'Iso', title: 'Isometric', keys: shortcut('Shift+P') },
        { value: '2d', label: '2D', title: 'Flat', keys: shortcut('Shift+P') },
      ]}
    />
  )
}
