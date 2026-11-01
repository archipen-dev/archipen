import { create } from 'zustand'

export interface Toast {
  id: number
  text: string
  tone: 'info' | 'error'
  /** A button next to the text. A toast with an action stays until it is clicked or dismissed. */
  action?: { label: string; run: () => void }
}

const DURATION: Record<Toast['tone'], number> = { info: 2600, error: 6000 }

export const useToasts = create<{ toasts: Toast[]; nextId: number }>(() => ({ toasts: [], nextId: 1 }))

export function dismissToast(id: number) {
  useToasts.setState((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
}

/** Show a short message at the bottom of the screen. */
export function toast(text: string, tone: Toast['tone'] = 'info', action?: Toast['action']) {
  const id = useToasts.getState().nextId
  useToasts.setState((s) => ({ nextId: id + 1, toasts: [...s.toasts, { id, text, tone, action }] }))
  if (!action) setTimeout(() => dismissToast(id), DURATION[tone])
  return id
}
