/*
 * Pages. A diagram has one or more pages; items live on exactly one of them.
 * Code that draws or edits one page works on a `PageDoc`: the diagram's settings
 * and assets with that page's items.
 */
import type { Draft } from 'immer'
import { newId } from './ids'
import type { Doc, Layer, Page, PageDoc } from './schema'

/** A new, empty page. */
export const makePage = (p: Partial<Page> = {}): Page => ({
  id: newId('p'),
  name: 'Page',
  description: '',
  nodes: [],
  zones: [],
  edges: [],
  texts: [],
  ...p,
})

/** The page with `id`, or the first page when there is none (`id` unknown or not given). */
export function pageById<D extends Doc | Draft<Doc>>(doc: D, id?: string | null): D['pages'][number] {
  return (id ? doc.pages.find((p) => p.id === id) : undefined) ?? doc.pages[0]
}

/** Whether `id` names a page of `doc`. */
export const hasPage = (doc: Doc, id: string) => doc.pages.some((p) => p.id === id)

const viewCache = new WeakMap<Doc, Map<string, PageDoc>>()

/** One page as a document. Memoised per doc object, so it's stable while the doc is. */
export function pageView(doc: Doc, id?: string | null): PageDoc {
  const page = pageById(doc, id)
  let byPage = viewCache.get(doc)
  if (!byPage) viewCache.set(doc, (byPage = new Map()))
  let view = byPage.get(page.id)
  if (!view) {
    const { pages: _pages, ...rest } = doc
    view = { ...rest, pageId: page.id, pageName: page.name, nodes: page.nodes, zones: page.zones, edges: page.edges, texts: page.texts }
    byPage.set(page.id, view)
  }
  return view
}

/** The page an item is on. */
export const pageOfItem = <D extends Doc | Draft<Doc>>(doc: D, id: string): D['pages'][number] | undefined =>
  doc.pages.find((p) => [p.nodes, p.zones, p.edges, p.texts].some((list) => list.some((it) => it.id === id)))

/** Every item on every page. */
export function* allItems(doc: Doc) {
  for (const p of doc.pages) yield* [...p.nodes, ...p.zones, ...p.edges, ...p.texts]
}

/** Total number of items on all pages. */
export const itemCount = (doc: Pick<Doc, 'pages'>) => doc.pages.reduce((n, p) => n + p.nodes.length + p.zones.length + p.edges.length + p.texts.length, 0)

/** Whether a page has nothing on it. */
export const isEmptyLayer = (l: Layer) => !l.nodes.length && !l.zones.length && !l.edges.length && !l.texts.length

/** Remove a page and every link pointing to it. Keeps at least one page. */
export function removePage(d: Draft<Doc>, id: string) {
  if (d.pages.length < 2) return
  d.pages = d.pages.filter((p) => p.id !== id)
  for (const p of d.pages) for (const it of [...p.nodes, ...p.zones]) if (it.link?.page === id) delete it.link
}

/** Pages that link to `id`, with the linking items. */
export function linksTo(doc: Doc, id: string): { page: Page; itemId: string }[] {
  const out: { page: Page; itemId: string }[] = []
  for (const p of doc.pages) for (const it of [...p.nodes, ...p.zones]) if (it.link?.page === id) out.push({ page: p, itemId: it.id })
  return out
}

/** The page a node or zone links to, if that page exists. */
export function linkTarget(doc: Doc, itemId: string): string | null {
  for (const p of doc.pages)
    for (const it of [...p.nodes, ...p.zones])
      if (it.id === itemId) return it.link && doc.pages.some((x) => x.id === it.link!.page) ? it.link.page : null
  return null
}
