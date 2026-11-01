/*
 * Pages: moving between them, and adding, renaming, reordering and removing them.
 * The page history (`ui.pageStack`) holds the pages opened after the first one; Back walks it.
 */
import { linkTarget, makePage, removePage } from '../model/pages'
import type { Doc } from '../model/schema'
import { currentPageId, getDoc } from '../store/selectors'
import { useUi } from '../store/uiStore'
import { mutate } from './mutate'

/** The page history for showing `id`: kept up to `id` if it's already on it, otherwise just `id`. */
function stackFor(doc: Doc, id: string, from: string[]): string[] {
  if (id === doc.pages[0].id) return []
  const i = from.indexOf(id)
  return i >= 0 ? from.slice(0, i + 1) : [id]
}

function show(stack: string[]) {
  const ui = useUi.getState()
  if (stack.join('\n') === ui.pageStack.join('\n')) return
  ui.setPageStack(stack) // the editor fits the new page into view
}

/** Drill into a page (a link was followed): it goes on the end of the page history. */
export function openPage(id: string) {
  const doc = getDoc()
  if (!doc || !doc.pages.some((p) => p.id === id) || id === currentPageId(doc)) return
  const stack = useUi.getState().pageStack.filter((x) => doc.pages.some((p) => p.id === x))
  show(id === doc.pages[0].id || stack.includes(id) ? stackFor(doc, id, stack) : [...stack, id])
}

/** Follow the link of a node or zone. False when it has none. */
export function followLink(itemId: string): boolean {
  const doc = getDoc()
  const target = doc && linkTarget(doc, itemId)
  if (!target) return false
  openPage(target)
  return true
}

/** Jump to a page from the page list: the page history starts over. */
export function goToPage(id: string) {
  const doc = getDoc()
  if (doc && doc.pages.some((p) => p.id === id)) show(stackFor(doc, id, useUi.getState().pageStack))
}

/** Back up the page history. False when already on the first page. */
export function backPage(): boolean {
  const stack = useUi.getState().pageStack
  if (!stack.length) return false
  show(stack.slice(0, -1))
  return true
}

/** Show the page whose items changed (after undo or redo), and drop pages that no longer exist from the page history. */
export function followPages(before: Doc | null, after: Doc | null) {
  if (!before || !after || before === after) return
  const ui = useUi.getState()
  const alive = ui.pageStack.filter((id) => after.pages.some((p) => p.id === id))
  const changed = after.pages.find((p) => before.pages.find((b) => b.id === p.id) !== p)
  if (changed && changed.id !== currentPageId(after, alive)) show(stackFor(after, changed.id, alive))
  else if (alive.length !== ui.pageStack.length) show(alive)
}

/** Add an empty page after the current one and show it. Returns its id. */
export function addPage(name = 'New page'): string | null {
  const doc = getDoc()
  if (!doc) return null
  const page = makePage({ name: uniqueName(doc, name) })
  const at = doc.pages.findIndex((p) => p.id === currentPageId(doc)) + 1
  mutate((d) => void d.pages.splice(at, 0, page))
  goToPage(page.id)
  return page.id
}

/** A new page named after a node or zone, linked from it. Stays on the current page; returns the page id. */
export function addLinkedPage(itemId: string, name: string): string | null {
  const doc = getDoc()
  if (!doc) return null
  const page = makePage({ name: uniqueName(doc, name.trim() || 'Detail') })
  mutate((d) => {
    d.pages.push(page)
    for (const p of d.pages) for (const it of [...p.nodes, ...p.zones]) if (it.id === itemId) it.link = { page: page.id }
  })
  return page.id
}

/** Link a node or zone to a page, or remove its link (`null`). */
export const setLink = (itemId: string, page: string | null) =>
  mutate((d) => {
    for (const p of d.pages)
      for (const it of [...p.nodes, ...p.zones])
        if (it.id === itemId) {
          if (page) it.link = { page }
          else delete it.link
        }
  })

export const renamePage = (id: string, name: string) =>
  mutate(
    (d) => {
      const page = d.pages.find((p) => p.id === id)
      if (page) page.name = name
    },
    { coalesce: `page-name:${id}` },
  )

/** Move a page one place earlier (-1) or later (1) in the list. */
export function movePage(id: string, dir: -1 | 1) {
  mutate((d) => {
    const i = d.pages.findIndex((p) => p.id === id)
    const j = i + dir
    if (i < 0 || j < 0 || j >= d.pages.length) return
    const [p] = d.pages.splice(i, 1)
    d.pages.splice(j, 0, p)
  })
  // The first page has no page history entry, so the stack may need rebuilding.
  const doc = getDoc()
  if (doc) {
    const top = currentPageId(doc)
    useUi.getState().setPageStack(stackFor(doc, top, useUi.getState().pageStack.filter((x) => x !== doc.pages[0].id)))
  }
}

/** Remove a page and the links to it. The last page can't be removed. */
export function deletePage(id: string) {
  const doc = getDoc()
  if (!doc || doc.pages.length < 2) return
  const leaving = currentPageId(doc) === id
  mutate((d) => removePage(d, id))
  const stack = useUi.getState().pageStack.filter((x) => x !== id)
  if (leaving) show(stack)
  else useUi.getState().setPageStack(stack)
}

function uniqueName(doc: Doc, name: string) {
  const taken = new Set(doc.pages.map((p) => p.name))
  if (!taken.has(name)) return name
  let n = 2
  while (taken.has(`${name} ${n}`)) n++
  return `${name} ${n}`
}
