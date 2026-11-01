import type { Draft } from 'immer'
import { mutateEntity } from '../../commands/mutate'

/** Set or clear an item's own style values (unset = follow the diagram default). Feeds the style fields. */
export function styleOps<S>(id: string) {
  return {
    set: (patch: Partial<S>, coalesce?: string) => mutateEntity<S>(id, (it) => void Object.assign(it as object, patch), coalesce),
    reset: (key: keyof S) => mutateEntity<S>(id, (it) => void delete (it as Record<keyof S, unknown>)[key]),
  }
}

/** Clear every one of `keys` on the item. */
export const resetKeys = <T,>(id: string, keys: readonly (keyof T)[]) => mutateEntity<T>(id, (it) => keys.forEach((k) => delete (it as Draft<T> & Record<keyof T, unknown>)[k]))

/** Set plain fields on the item (size, kind…). */
export const patchItem = <T,>(id: string, patch: Partial<T>, coalesce?: string) => mutateEntity<T>(id, (it) => void Object.assign(it as object, patch), coalesce)
