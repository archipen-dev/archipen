import type { Asset } from '../model/schema'
import { LUCIDE_ICONS, type IconNode } from './lucideSet'
import { vendorPath } from './vendorLoader'
import { VENDOR_ICONS } from './vendorSet'

export interface IconMarkup {
  viewBox: [number, number, number, number]
  body: string
  /** "stroke": line icon tinted with one colour; "fill": solid logo tinted with one colour; "asset": drawn as is. */
  style: 'stroke' | 'fill' | 'asset'
  /** Colour to use when the item doesn't set one (vendor logos). */
  brandColor?: string
}

const esc = (v: string | number) => String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

export function iconNodeToMarkup(node: IconNode): string {
  return node
    .map(([tag, attrs]) => {
      const a = Object.entries(attrs)
        .filter(([k, v]) => v !== undefined && k !== 'key')
        .map(([k, v]) => `${k}="${esc(v as string | number)}"`)
        .join(' ')
      return `<${tag} ${a}/>`
    })
    .join('')
}

const lucideCache = new Map<string, IconMarkup>()
const vendorCache = new Map<string, IconMarkup>()

export function resolveIcon(ref: string | undefined, assets: Record<string, Asset>): IconMarkup | null {
  if (!ref) return null
  const [kind, id] = ref.split(':', 2)
  if (kind === 'lucide') {
    let m = lucideCache.get(id)
    if (!m) {
      const node = LUCIDE_ICONS[id]
      if (!node) return null
      m = { viewBox: [0, 0, 24, 24], body: iconNodeToMarkup(node), style: 'stroke' }
      lucideCache.set(id, m)
    }
    return m
  }
  if (kind === 'vendor') {
    let m = vendorCache.get(id)
    if (!m) {
      const v = VENDOR_ICONS[id]
      const path = vendorPath(id)
      // Not cached while missing: the shape may still be loading (see vendorLoader).
      if (!v || !path) return null
      m = { viewBox: [0, 0, 24, 24], body: `<path d="${esc(path)}"/>`, style: 'fill', brandColor: v.hex }
      vendorCache.set(id, m)
    }
    return m
  }
  if (kind === 'custom') {
    const a = assets[id]
    return a ? { viewBox: a.viewBox, body: a.body, style: 'asset' } : null
  }
  return null
}

export const LUCIDE_NAMES = Object.keys(LUCIDE_ICONS)
export const VENDOR_NAMES = Object.keys(VENDOR_ICONS)
