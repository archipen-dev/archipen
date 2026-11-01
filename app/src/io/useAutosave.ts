import { useEffect } from 'react'
import { useDocStore } from '../store/docStore'
import { storeDoc } from './autosave'

/** Persist the open document to IndexedDB shortly after every change. */
export function useAutosave(delay = 600) {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const flush = () => {
      const { doc, revision, savedRevision, ephemeral } = useDocStore.getState()
      if (doc && !ephemeral) void storeDoc(doc, revision !== savedRevision).catch((e) => console.warn('Autosave failed', e))
    }
    const unsub = useDocStore.subscribe((s, prev) => {
      if (!s.doc || s.txBase) return
      if (s.doc === prev.doc && !prev.txBase && s.savedRevision === prev.savedRevision) return
      clearTimeout(timer)
      timer = setTimeout(flush, delay)
    })
    const onUnload = (e: BeforeUnloadEvent) => {
      flush()
      const { revision, savedRevision, ephemeral } = useDocStore.getState()
      if (revision !== savedRevision && !ephemeral) e.preventDefault()
    }
    window.addEventListener('beforeunload', onUnload)
    return () => {
      unsub()
      clearTimeout(timer)
      flush()
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [delay])
}
