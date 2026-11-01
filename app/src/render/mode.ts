import { createContext, createElement, useContext, type ReactElement } from 'react'
import { a11yLabel } from './describe'

export type A11yRole = 'node' | 'zone' | 'connection' | 'note' | 'text'

/** What a screen reader is told about one item (see export/describe). */
export interface A11yItem {
  role: A11yRole
  /** One sentence describing the item. */
  text: string
  /** Nodes and zones: the wires attached, from this item's side. */
  connections?: string
  /** Nodes and zones that link to another page: which one. */
  link?: string
}

/** How the scene is drawn. The live canvas uses the defaults; exports switch off what only the editor needs. */
export interface RenderMode {
  /** Leave out editor-only markup: hit areas and the data-id/kind/label attributes. */
  bare: boolean
  /**
   * PDF text: no halos (PDF has no paint-order), this font family on every label,
   * and weights as "bold"/"normal" so the two embedded cuts are picked.
   */
  pdfFont?: string
  /** Per-item descriptions. Shapes get a role and a name (and a <title> in exports); labels are hidden from screen readers. */
  a11y?: Map<string, A11yItem>
  /** Exports with several pages: item id → link to the page it opens. */
  links?: Map<string, string>
}
export const RenderModeContext = createContext<RenderMode>({ bare: false })

/** The data attributes the canvas uses for hit testing, unless the scene is drawn bare. */
export function tagAttrs(bare: boolean, id: string, kind: string, label = false): Record<string, string> {
  if (bare) return {}
  return label ? { 'data-id': id, 'data-kind': kind, 'data-label': '1' } : { 'data-id': id, 'data-kind': kind }
}

/** DOM id of an item's shape on the canvas, for aria-activedescendant. Item ids can be any string. */
export const a11yElementId = (id: string) => `ap-item-${id.replace(/[^\w-]/g, (c) => `_${c.codePointAt(0)!.toString(16)}_`)}`

/** Attributes for an item's shape group: hit-test data and an element id on the canvas, plus role and name when described. */
export function useTag(id: string, kind: string): Record<string, string> {
  const { bare, a11y } = useContext(RenderModeContext)
  const data = tagAttrs(bare, id, kind)
  const item = a11y?.get(id)
  if (!item) return data
  const named = { role: item.role === 'zone' ? 'group' : 'graphics-symbol', 'aria-roledescription': item.role, 'aria-label': a11yLabel(item) }
  return bare ? named : { ...data, ...named, id: a11yElementId(id) }
}

/** The item's description as a <title> (also a hover tooltip). Exports only: the editor has its own hover. */
export function A11yTitle({ id }: { id: string }) {
  const { bare, a11y } = useContext(RenderModeContext)
  const item = bare ? a11y?.get(id) : undefined
  return item ? createElement('title', null, a11yLabel(item)) : null
}

/** Wraps an item's shape in a link when the export makes it clickable (`RenderMode.links`). */
export function LinkWrap({ id, children }: { id: string; children: ReactElement }) {
  const href = useContext(RenderModeContext).links?.get(id)
  return href ? createElement('a', { href }, children) : children
}

/** Attributes for decoration a screen reader should skip (labels and icons repeat the shape's description). */
export function useDecorative(): Record<string, string> {
  return useContext(RenderModeContext).a11y ? { 'aria-hidden': 'true' } : {}
}
