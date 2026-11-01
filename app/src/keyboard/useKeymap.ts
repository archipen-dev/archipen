import { useEffect, useRef } from 'react'
import { isTypingIn } from '../lib/dom'
import { useDocStore } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { BINDINGS, matches, toKeyPress, type KeyContext, type KeymapActions } from './keymap'

/** Run the first binding that matches each key press. */
export function dispatchKey(e: KeyboardEvent, actions: KeymapActions): boolean {
  const { doc, ephemeral } = useDocStore.getState()
  if (!doc) return false
  const ui = useUi.getState()
  const press = toKeyPress(e)
  const typing = isTypingIn(e.target)
  const dialogOpen = !!document.querySelector('[role="dialog"]')
  const ctx: KeyContext = { press, ui, doc, edit: ui.mode === 'edit', ephemeral, actions }
  for (const b of BINDINGS) {
    if ((typing || dialogOpen) && !b.whileTyping) continue
    if (!matches(b, press) || (b.when && !b.when(ctx))) continue
    if (b.mayDecline) {
      if (b.run(ctx) === false) return false
      e.preventDefault()
      return true
    }
    if (b.preventDefault !== false) e.preventDefault()
    b.run(ctx)
    return true
  }
  return false
}

/** Keyboard shortcuts for the editor screen, plus Space-to-pan. */
export function useKeymap(actions: KeymapActions) {
  // The listener is attached once; it always calls the latest actions.
  const latest = useRef(actions)
  useEffect(() => {
    latest.current = actions
  })

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !isTypingIn(e.target) && !document.querySelector('[role="dialog"]') && useDocStore.getState().doc) {
        e.preventDefault()
        useUi.getState().setSpaceDown(true)
        return
      }
      dispatchKey(e, latest.current)
    }
    const onKeyUp = (e: KeyboardEvent) => e.code === 'Space' && useUi.getState().setSpaceDown(false)
    const onBlur = () => useUi.getState().setSpaceDown(false)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
    }
  }, [])
}
