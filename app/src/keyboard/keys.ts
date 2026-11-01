/*
 * Shortcut labels for the user's platform: Mac symbols (⇧⌘S) on Apple devices,
 * Ctrl/Shift/Alt words (Ctrl+Shift+S) everywhere else. "Mod" is ⌘ on a Mac and Ctrl elsewhere,
 * matching the key handler, which accepts either.
 */

type Nav = Navigator & { userAgentData?: { platform?: string } }
const platform = typeof navigator === 'undefined' ? '' : ((navigator as Nav).userAgentData?.platform ?? navigator.platform ?? navigator.userAgent)

export const IS_MAC = /mac|iphone|ipad|ipod/i.test(platform)

const MAC: Record<string, string> = { Ctrl: '⌃', Alt: '⌥', Shift: '⇧', Mod: '⌘' }
const OTHER: Record<string, string> = { Ctrl: 'Ctrl', Alt: 'Alt', Shift: 'Shift', Mod: 'Ctrl' }
const MAC_ORDER = ['Ctrl', 'Alt', 'Shift', 'Mod']

/** "Mod+Shift+S" → "⇧⌘S" on a Mac, "Ctrl+Shift+S" elsewhere. The key itself may be "+". */
export function shortcut(combo: string, mac = IS_MAC): string {
  const m = /^((?:(?:Mod|Shift|Alt|Ctrl)\+)*)(.+)$/.exec(combo)!
  const mods = m[1].split('+').filter(Boolean)
  const key = m[2]
  if (mac) return mods.sort((a, b) => MAC_ORDER.indexOf(a) - MAC_ORDER.indexOf(b)).map((k) => MAC[k]).join('') + key
  return [...mods.map((k) => OTHER[k]), key].join('+')
}

/** Label of a single modifier, for "Ctrl + scroll" style hints. */
export const modifier = (name: 'Mod' | 'Shift' | 'Alt', mac = IS_MAC) => (mac ? MAC : OTHER)[name]

/**
 * The letter of a shortcut key press, independent of the keyboard layout's alphabet.
 * Uses the typed letter when it is a-z (so AZERTY and Dvorak keep their own letters),
 * and falls back to the physical key on layouts without Latin letters (Cyrillic, Greek, …).
 */
export function shortcutLetter(e: Pick<KeyboardEvent, 'key' | 'code'>): string {
  const key = e.key.toLowerCase()
  if (/^[a-z]$/.test(key)) return key
  if (/^Key[A-Z]$/.test(e.code)) return e.code.slice(3).toLowerCase()
  return key
}
