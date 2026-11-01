import { create } from 'zustand'

/** App-level preferences kept in localStorage. */
export interface Prefs {
  theme: 'light' | 'dark' | 'system'
  /** Side-panel sections the user opened or closed, by section id (true = open). */
  sections: Record<string, boolean>
  /** Export menu, diagrams with several pages: SVG and PDF with every page, or just the one on screen. */
  exportPages: 'all' | 'current'
}

const PREFS_KEY = 'archipen.prefs'
const DEFAULTS: Prefs = { theme: 'system', sections: {}, exportPages: 'all' }

function loadPrefs(): Prefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY)
    if (raw) return { ...DEFAULTS, ...JSON.parse(raw) }
  } catch {
    /* storage unavailable */
  }
  return DEFAULTS
}

interface PrefsStore extends Prefs {
  setPrefs: (p: Partial<Prefs>) => void
  setSectionOpen: (id: string, open: boolean) => void
}

export const usePrefs = create<PrefsStore>((set, get) => ({
  ...loadPrefs(),
  setPrefs: (p) => {
    set(p)
    try {
      const { theme, sections, exportPages } = get()
      localStorage.setItem(PREFS_KEY, JSON.stringify({ theme, sections, exportPages } satisfies Prefs))
    } catch {
      /* storage unavailable */
    }
  },
  setSectionOpen: (id, open) => get().setPrefs({ sections: { ...get().sections, [id]: open } }),
}))
