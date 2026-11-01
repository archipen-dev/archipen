/*
 * Every keyboard shortcut, as an ordered table of bindings. The first binding that
 * matches the key press (and whose `when` holds) runs. The shortcuts dialog reads
 * the same table, so the help can't drift from what the keys do.
 */
import { copy, cut, duplicate, paste } from '../commands/clipboard'
import { toggleProjection } from '../commands/document'
import { deleteIds, nudge, toggleFlag } from '../commands/edit'
import { history } from '../commands/mutate'
import { backPage, followLink } from '../commands/pages'
import { clearSelection, select, selectAll, selectNext } from '../commands/selection'
import { fitAll, fitSelection, zoomIn, zoomOut, zoomTo } from '../commands/view'
import { canvasFocused } from '../lib/dom'
import type { Doc } from '../model/schema'
import { useUi } from '../store/uiStore'
import { IS_MAC, modifier, shortcut, shortcutLetter } from './keys'
import { isViewTool, TOOLS } from './tools'

/** What the editor screen provides to the shortcuts. */
export interface KeymapActions {
  save: (saveAs: boolean) => void
  open: () => void
  enterPresentation: () => void
  exitPresentation: () => void
}

/** A normalised key press. */
export interface KeyPress {
  /** The typed key, lower case; for Mod shortcuts the layout-independent letter. */
  key: string
  code: string
  mod: boolean
  shift: boolean
  alt: boolean
}

export interface KeyContext {
  press: KeyPress
  ui: ReturnType<typeof useUi.getState>
  doc: Doc
  edit: boolean
  ephemeral: boolean
  actions: KeymapActions
}

export type HelpGroup = 'Tools' | 'Navigate' | 'Edit' | 'Diagram'

export interface Binding {
  id: string
  /** Modifiers left out don't matter, except Mod, which must match (default: not pressed). */
  match: { key?: string | string[]; code?: string; mod?: boolean; shift?: boolean; alt?: boolean }
  when?: (c: KeyContext) => boolean
  run: (c: KeyContext) => void | boolean
  /** Default true: stop the browser's own handling. */
  preventDefault?: boolean
  /** `run` returning false means it didn't apply: the browser handles the key as usual. */
  mayDecline?: boolean
  /** Also runs while a text field has focus. */
  whileTyping?: boolean
  help?: { group: HelpGroup; label: string; keys: string[] }
}

export function toKeyPress(e: Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>): KeyPress {
  // AltGr arrives as Ctrl+Alt on Windows; typing an AltGr character must not trigger Ctrl shortcuts.
  const mod = (e.metaKey || e.ctrlKey) && !(e.ctrlKey && e.altKey)
  return { key: mod ? shortcutLetter(e) : e.key.toLowerCase(), code: e.code, mod, shift: e.shiftKey, alt: e.altKey }
}

export function matches(b: Binding, p: KeyPress): boolean {
  const m = b.match
  if ((m.mod ?? false) !== p.mod) return false
  if (m.shift !== undefined && m.shift !== p.shift) return false
  if (m.alt !== undefined && m.alt !== p.alt) return false
  if (m.code !== undefined && m.code !== p.code) return false
  if (m.key !== undefined && !(Array.isArray(m.key) ? m.key.includes(p.key) : m.key === p.key)) return false
  return true
}

const edit = (c: KeyContext) => c.edit
const hasSelection = (c: KeyContext) => c.ui.selection.length > 0
const editSelection = (c: KeyContext) => c.edit && hasSelection(c)
const sel = (c: KeyContext) => c.ui.selection
const M = modifier('Mod')
const S = modifier('Shift')

/** In iso the arrows follow the screen: → moves right on screen, which is +x −y in the world. */
const ARROWS: Record<string, { iso: [number, number]; flat: [number, number] }> = {
  arrowright: { iso: [1, -1], flat: [1, 0] },
  arrowleft: { iso: [-1, 1], flat: [-1, 0] },
  arrowup: { iso: [-1, -1], flat: [0, -1] },
  arrowdown: { iso: [1, 1], flat: [0, 1] },
}

export const BINDINGS: Binding[] = [
  // Save works everywhere, even while typing. With Shift: save as.
  {
    id: 'save',
    match: { key: 's', mod: true },
    whileTyping: true,
    run: (c) => c.actions.save(c.press.shift),
    help: { group: 'Diagram', label: 'Save', keys: [M, 'S'] },
  },

  { id: 'fit', match: { code: 'Digit1', shift: true }, run: () => fitAll(), help: { group: 'Navigate', label: 'Zoom to fit', keys: [S, '1'] } },

  // Presentation.
  {
    id: 'present-escape',
    match: { key: 'escape' },
    when: (c) => c.ui.presenting,
    run: (c) => (hasSelection(c) ? clearSelection() : c.actions.exitPresentation()),
  },
  {
    id: 'present',
    match: { key: 'p', shift: false, alt: false },
    run: (c) => (c.ui.presenting ? c.actions.exitPresentation() : c.actions.enterPresentation()),
    help: { group: 'Diagram', label: 'Present (full screen)', keys: ['P'] },
  },

  // Mod shortcuts.
  { id: 'open', match: { key: 'o', mod: true }, run: (c) => c.actions.open(), help: { group: 'Diagram', label: 'Open', keys: [M, 'O'] } },
  { id: 'zoom-in', match: { key: ['=', '+'], mod: true }, run: () => zoomIn(), help: { group: 'Navigate', label: 'Zoom in / out', keys: [M, '+ / −'] } },
  { id: 'zoom-out', match: { key: '-', mod: true }, run: () => zoomOut() },
  { id: 'zoom-100-mod', match: { key: '0', mod: true }, run: () => zoomTo(1) },
  {
    id: 'undo',
    match: { key: 'z', mod: true },
    when: edit,
    run: (c) => (c.press.shift ? history.redo() : history.undo()),
    help: { group: 'Edit', label: 'Undo / redo', keys: [M, `Z / ${shortcut('Shift+Z')}`] },
  },
  { id: 'redo', match: { key: 'y', mod: true }, when: edit, run: () => history.redo() },
  { id: 'select-all', match: { key: 'a', mod: true }, when: edit, run: () => selectAll(), help: { group: 'Edit', label: 'Select all', keys: [M, 'A'] } },
  { id: 'lock', match: { key: 'l', mod: true, shift: true }, when: edit, run: (c) => toggleFlag(sel(c), 'locked'), help: { group: 'Edit', label: 'Lock / unlock', keys: [shortcut('Mod+Shift+L')] } },
  { id: 'hide', match: { key: 'h', mod: true, shift: true }, when: edit, run: (c) => toggleFlag(sel(c), 'hidden'), help: { group: 'Edit', label: 'Hide / show', keys: [shortcut('Mod+Shift+H')] } },
  {
    id: 'duplicate',
    match: { key: 'd', mod: true },
    when: edit,
    run: (c) => hasSelection(c) && select(duplicate(sel(c))),
    help: { group: 'Edit', label: 'Duplicate', keys: [M, 'D'] },
  },
  { id: 'copy', match: { key: 'c', mod: true }, when: editSelection, preventDefault: false, run: (c) => copy(sel(c)), help: { group: 'Edit', label: 'Copy / paste', keys: [M, 'C / V'] } },
  { id: 'cut', match: { key: 'x', mod: true }, when: editSelection, preventDefault: false, run: (c) => cut(sel(c)) },
  {
    id: 'paste',
    match: { key: 'v', mod: true },
    when: edit,
    preventDefault: false,
    run: () => {
      const ids = paste()
      if (ids.length) select(ids)
    },
  },

  // Navigation. Tab steps through the items while the canvas has focus; past the last one, focus moves on.
  {
    id: 'next-item',
    match: { key: 'tab', shift: false },
    when: () => canvasFocused(),
    mayDecline: true,
    run: () => selectNext(1),
    help: { group: 'Navigate', label: 'Next / previous item', keys: ['Tab', shortcut('Shift+Tab')] },
  },
  { id: 'prev-item', match: { key: 'tab', shift: true }, when: () => canvasFocused(), mayDecline: true, run: () => selectNext(-1) },
  {
    id: 'open-link',
    match: { key: 'enter', mod: true },
    when: (c) => c.ui.selection.length === 1,
    mayDecline: true,
    run: (c) => followLink(c.ui.selection[0]),
    help: { group: 'Navigate', label: 'Open linked page', keys: [M, 'Enter'] },
  },
  // While viewing, Enter alone opens the link too (it renames while editing).
  { id: 'open-link-view', match: { key: 'enter' }, when: (c) => !c.edit && c.ui.selection.length === 1, mayDecline: true, run: (c) => followLink(c.ui.selection[0]) },
  {
    id: 'page-back',
    match: { key: 'arrowleft', alt: true },
    mayDecline: true,
    run: () => backPage(),
    help: { group: 'Navigate', label: 'Back to the previous page', keys: [modifier('Alt'), '←'] },
  },
  { id: 'page-back-view', match: { key: 'backspace' }, when: (c) => !c.edit, mayDecline: true, run: () => backPage() },
  { id: 'fit-selection', match: { code: 'Digit2', shift: true }, run: () => fitSelection(), help: { group: 'Navigate', label: 'Zoom to selection', keys: [S, '2'] } },
  { id: 'zoom-100', match: { code: 'Digit0', shift: true }, run: () => zoomTo(1), help: { group: 'Navigate', label: 'Zoom to 100%', keys: [S, '0'] } },
  { id: 'projection', match: { code: 'KeyP', shift: true }, run: () => toggleProjection(), help: { group: 'Diagram', label: 'Isometric / 2D', keys: [S, 'P'] } },
  { id: 'help', match: { key: '?' }, preventDefault: false, run: (c) => c.ui.openDialog('shortcuts'), help: { group: 'Diagram', label: 'Shortcuts', keys: ['?'] } },

  // Escape backs out one step: tool, then selection.
  {
    id: 'escape',
    match: { key: 'escape' },
    preventDefault: false,
    run: ({ ui }) => {
      if (ui.tool !== 'select') ui.setTool('select')
      else if (ui.selection.length) ui.select([])
    },
  },

  // Tools.
  ...TOOLS.map(
    (t): Binding => ({
      id: `tool-${t.tool}`,
      match: { key: t.key.toLowerCase(), shift: false, alt: false },
      preventDefault: false,
      run: (c) => (c.edit || isViewTool(t.tool)) && c.ui.setTool(t.tool),
      help: { group: 'Tools', label: t.label, keys: [t.key] },
    }),
  ),

  // Editing the selection.
  { id: 'delete', match: { key: ['delete', 'backspace'] }, when: editSelection, run: (c) => deleteIds(sel(c)), help: { group: 'Edit', label: 'Delete', keys: [IS_MAC ? '⌫' : 'Del'] } },
  {
    id: 'rename',
    match: { key: 'enter' },
    when: (c) => c.edit && c.ui.selection.length === 1,
    run: (c) => c.ui.setEditing(c.ui.selection[0]),
    help: { group: 'Edit', label: 'Rename', keys: ['Enter'] },
  },
  {
    id: 'nudge',
    match: { key: Object.keys(ARROWS) },
    when: editSelection,
    run: (c) => {
      const iso = c.doc.settings.projection === 'iso'
      const [dx, dy] = ARROWS[c.press.key][iso ? 'iso' : 'flat']
      const k = c.press.shift ? (iso ? 5 : 10) : 1
      nudge(sel(c), dx * k, dy * k)
    },
    help: { group: 'Edit', label: 'Nudge', keys: ['←↑→↓'] },
  },
]

/** Rows of the shortcuts dialog: binding ids, or pointer gestures that have no binding. */
type HelpRow = string | { label: string; keys: string[] }

const HELP_LAYOUT: [HelpGroup, HelpRow[]][] = [
  ['Tools', TOOLS.map((t) => `tool-${t.tool}`)],
  [
    'Navigate',
    [
      { label: 'Pan', keys: ['Space', 'drag'] },
      { label: 'Pan', keys: ['Scroll'] },
      { label: 'Zoom', keys: [M, 'scroll'] },
      'next-item',
      'open-link',
      { label: 'Open linked page', keys: [M, 'click'] },
      'page-back',
      'fit',
      'fit-selection',
      'zoom-100',
      'zoom-in',
    ],
  ],
  [
    'Edit',
    [
      'rename',
      'delete',
      'duplicate',
      'copy',
      'nudge',
      { label: 'Nudge ×10', keys: [S, '←↑→↓'] },
      { label: 'Duplicate while dragging', keys: [modifier('Alt'), 'drag'] },
      { label: 'Move without snapping', keys: [M, 'drag'] },
      'undo',
      'select-all',
      'lock',
      'hide',
    ],
  ],
  ['Diagram', ['projection', 'present', 'save', { label: 'Save as', keys: [shortcut('Mod+Shift+S')] }, 'open', 'help']],
]

/** The shortcuts dialog content, grouped. */
export function shortcutHelp(): { group: HelpGroup; rows: { label: string; keys: string[] }[] }[] {
  const byId = new Map(BINDINGS.filter((b) => b.help).map((b) => [b.id, b.help!]))
  return HELP_LAYOUT.map(([group, rows]) => ({
    group,
    rows: rows.map((r) => {
      if (typeof r !== 'string') return r
      const h = byId.get(r)
      if (!h) throw new Error(`No help for shortcut "${r}"`)
      return h
    }),
  }))
}
