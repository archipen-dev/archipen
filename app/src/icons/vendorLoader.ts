import { useEffect, useSyncExternalStore } from 'react'
import { VENDOR_CORE_PATHS } from './vendorPathsCore'
import { VENDOR_ICONS } from './vendorSet'

// Vendor logo shapes come in two parts: the common ones ship with the app, the rest are a separate chunk.
// The rest loads when the icon picker opens, or as soon as something on screen uses one of them.

let rest: Record<string, string> | null = null
let pending: Promise<void> | null = null
const listeners = new Set<() => void>()

/** The logo's path, or undefined if it is unknown or not loaded yet. */
export function vendorPath(slug: string): string | undefined {
  return VENDOR_CORE_PATHS[slug] ?? rest?.[slug]
}

/** Load the remaining logo shapes (once). Safe to call repeatedly; a failed load can be retried. */
export function loadAllVendorIcons(): Promise<void> {
  if (rest) return Promise.resolve()
  pending ??= import('./vendorPathsRest').then(
    (m) => {
      rest = m.VENDOR_REST_PATHS
      for (const l of listeners) l()
    },
    (err) => {
      pending = null
      throw err
    },
  )
  return pending
}

/** Whether any of these icon refs is a known vendor logo whose shape hasn't loaded yet. */
export function needsMoreVendorIcons(refs: Iterable<string | undefined>): boolean {
  if (rest) return false
  for (const ref of refs) {
    if (!ref?.startsWith('vendor:')) continue
    const slug = ref.slice(7)
    if (VENDOR_ICONS[slug] && !VENDOR_CORE_PATHS[slug]) return true
  }
  return false
}

/** Make sure every vendor logo among `refs` can be drawn. Resolves at once when nothing is missing. */
export async function ensureVendorIcons(refs: Iterable<string | undefined>): Promise<boolean> {
  if (!needsMoreVendorIcons(refs)) return false
  await loadAllVendorIcons()
  return true
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}
const allLoaded = () => rest !== null

/**
 * Re-render when the remaining logos arrive, and start loading them if `refs` use one. Pass `'all'` to load
 * them regardless (the icon picker). Returns whether everything is loaded.
 */
export function useVendorIcons(refs: readonly (string | undefined)[] | 'all' | null): boolean {
  const loaded = useSyncExternalStore(subscribe, allLoaded, allLoaded)
  const wanted = refs === 'all' || (refs !== null && needsMoreVendorIcons(refs))
  useEffect(() => {
    if (!loaded && wanted) loadAllVendorIcons().catch((err) => console.error('Could not load vendor icons', err))
  }, [loaded, wanted])
  return loaded
}
