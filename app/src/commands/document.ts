import type { Draft } from 'immer'
import { defaultSettings } from '../model/defaults'
import { itemsOf } from '../model/entities'
import { STYLE_KEYS } from '../model/styles'
import type { Asset, EntityKind, LabelStyle, Page, Settings, StyleDefaults } from '../model/schema'
import { getDoc } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { mutate } from './mutate'
import { fitAll } from './view'

export const renameDoc = (name: string) => mutate((d) => void (d.name = name), { coalesce: 'doc-name' })

/** The projection is a way of looking, not an edit: no undo step. */
export function setProjection(next: Settings['projection']) {
  const current = getDoc()?.settings.projection
  if (!current || next === current) return
  const ui = useUi.getState()
  ui.saveViewport(current, ui.viewport)
  mutate((d) => void (d.settings.projection = next), { history: false })
  // Back to where this projection was last looked at, or fit on the first visit (the two use different coordinates).
  const saved = useUi.getState().savedViewports[next]
  if (saved) ui.setViewport(saved)
  else fitAll()
}

export const toggleProjection = () => setProjection(getDoc()?.settings.projection === 'iso' ? '2d' : 'iso')

export const setCrossing = (crossing: Settings['crossing']) => mutate((d) => void (d.settings.crossing = crossing))
export const setGrid = (grid: boolean) => mutate((d) => void (d.settings.grid = grid))

// ---- diagram-wide defaults ---------------------------------------------------

export const writeStyleDefaults = (kind: EntityKind, fn: (s: Draft<StyleDefaults>) => void, coalesce?: string) =>
  mutate((d) => fn(d.settings.styles), coalesce ? { coalesce: `styles:${kind}:${coalesce}` } : undefined)

export const setLabelDefaults = (kind: EntityKind, patch: Partial<LabelStyle>) => mutate((d) => void Object.assign(d.settings.labelDefaults[kind], patch))

/** Put the built-in style and label defaults for one kind back. */
export const restoreKindDefaults = (kind: EntityKind) =>
  mutate((d) => {
    const def = defaultSettings()
    d.settings.labelDefaults[kind] = def.labelDefaults[kind]
    if (kind === 'text') {
      d.settings.styles.text = def.styles.text
      d.settings.styles.note = def.styles.note
    } else d.settings.styles[kind] = def.styles[kind] as never
  })

/** Make every item of `kind` follow the defaults again. */
export const clearKindOverrides = (kind: EntityKind) =>
  mutate((d) => {
    for (const page of d.pages)
      for (const it of itemsOf(page as Page, kind) as unknown as Record<string, unknown>[]) {
        delete it.label
        for (const k of STYLE_KEYS[kind]) delete it[k]
      }
  })

// ---- custom icons -----------------------------------------------------------

export const addAsset = (asset: Asset) => mutate((d) => void (d.assets[asset.id] = asset))

/** Remove an uploaded icon and take it off every node that used it. */
export const removeAsset = (id: string) =>
  mutate((d) => {
    delete d.assets[id]
    for (const p of d.pages) for (const n of p.nodes) if (n.icon === `custom:${id}`) n.icon = undefined
  })
