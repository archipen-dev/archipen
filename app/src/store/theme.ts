import { useSyncExternalStore } from 'react'
import { DARK, LIGHT, type CanvasTheme } from '../render/theme'
import { usePrefs } from './prefsStore'

const query = () => (typeof matchMedia === 'undefined' ? null : matchMedia('(prefers-color-scheme: dark)'))

function subscribe(onChange: () => void) {
  const mq = query()
  mq?.addEventListener('change', onChange)
  return () => mq?.removeEventListener('change', onChange)
}
const systemTheme = (): 'light' | 'dark' => (query()?.matches ? 'dark' : 'light')

/** Light or dark: the preference, else the system setting. */
export function useResolvedTheme(): 'light' | 'dark' {
  const pref = usePrefs((s) => s.theme)
  const sys = useSyncExternalStore(subscribe, systemTheme, () => 'light' as const)
  return pref === 'system' ? sys : pref
}

export const useCanvasTheme = (): CanvasTheme => (useResolvedTheme() === 'dark' ? DARK : LIGHT)
