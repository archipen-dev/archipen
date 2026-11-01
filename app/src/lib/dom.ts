/** True when keyboard input goes to a text field rather than the canvas. */
export function isTypingIn(target: EventTarget | Element | null): boolean {
  const el = target as HTMLElement | null
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT' || !!el.isContentEditable)
}

/** Two animation frames: after React commits and the browser lays out (e.g. after going full screen). */
export function afterLayout(fn: () => void) {
  requestAnimationFrame(() => requestAnimationFrame(fn))
}

export const isAbortError = (e: unknown) => e instanceof DOMException && e.name === 'AbortError'

export const errorMessage = (e: unknown, fallback = 'Something went wrong') => (e instanceof Error && e.message) || fallback

/** The diagram canvas has keyboard focus. */
export const canvasFocused = () => !!document.activeElement?.closest('[data-canvas]')
