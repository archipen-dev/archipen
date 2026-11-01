import type { Draft } from 'immer'
import { withEntity } from '../model/entities'
import { pageById } from '../model/pages'
import type { Doc, Page } from '../model/schema'
import { useDocStore } from '../store/docStore'
import { useUi } from '../store/uiStore'
import { followPages } from './pages'

export type Recipe = (d: Draft<Doc>) => void
export interface MutateOptions {
  /** False: no undo step (view settings like the projection). */
  history?: boolean
  /** Edits with the same key in quick succession merge into one undo step. */
  coalesce?: string
}

/**
 * Apply a change to the open document. The recipe's return value is ignored: Immer would
 * otherwise treat a returned value as a replacement for the whole document.
 */
export const mutate = (recipe: Recipe, opts?: MutateOptions) =>
  useDocStore.getState().update((d) => {
    recipe(d)
  }, opts)

/** Apply a change to the page on screen. `d` is the whole document, for settings and assets. */
export const mutatePage = (recipe: (page: Draft<Page>, d: Draft<Doc>) => void, opts?: MutateOptions) =>
  mutate((d) => recipe(pageById(d, useUi.getState().pageStack.at(-1)), d), opts)

/** Change one item (on any page), whatever its kind. `T` is the item type the caller knows it has. */
export function mutateEntity<T>(id: string, fn: (item: Draft<T>) => void, coalesce?: string) {
  mutate(
    (d) =>
      withEntity(d, id, (item) => {
        fn(item as Draft<T>)
      }),
    coalesce ? { coalesce: `${id}:${coalesce}` } : undefined,
  )
}

/** Group several changes (a drag) into one undo step. */
export const history = {
  begin: () => useDocStore.getState().begin(),
  commit: () => useDocStore.getState().commit(),
  cancel: () => useDocStore.getState().cancel(),
  undo: () => followingPages(() => useDocStore.getState().undo()),
  redo: () => followingPages(() => useDocStore.getState().redo()),
}

/** Undo and redo show the page they changed. */
function followingPages(run: () => void) {
  const before = useDocStore.getState().doc
  run()
  followPages(before, useDocStore.getState().doc)
}
