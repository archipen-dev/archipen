import type { ComponentProps } from 'react'
import { usePrefs } from '../../store/prefsStore'
import { Section } from '../../ui'

type Props = Omit<ComponentProps<typeof Section>, 'open' | 'onOpenChange'> & {
  /** Stable key for remembering open/closed; the title can't be used since some include counts. */
  id: string
}

/** A side-panel section that stays open or closed across selections and reloads. */
export function SavedSection({ id, defaultOpen = true, ...rest }: Props) {
  const open = usePrefs((s) => s.sections[id] ?? defaultOpen)
  const setSectionOpen = usePrefs((s) => s.setSectionOpen)
  return <Section {...rest} open={open} onOpenChange={(o) => setSectionOpen(id, o)} />
}
