import { del, entries, get, set } from 'idb-keyval'
import { parseDoc } from '../model/defaults'
import type { Doc } from '../model/schema'

export interface StoredDoc {
  doc: Doc
  updatedAt: string
  /** True when this version has changes not written to a file on disk. */
  dirty?: boolean
}

const key = (id: string) => `doc:${id}`

let persistAsked = false

/**
 * Ask the browser to keep this site's storage under storage pressure instead of evicting it with the
 * autosaved diagrams. Asked once per tab; the browser may grant it silently, prompt, or refuse.
 */
function askPersist() {
  if (persistAsked) return
  persistAsked = true
  void navigator.storage
    ?.persisted?.()
    .then((done) => done || navigator.storage.persist())
    .catch(() => {})
}

export async function storeDoc(doc: Doc, dirty = false): Promise<void> {
  askPersist()
  await set(key(doc.id), { doc, updatedAt: new Date().toISOString(), dirty } satisfies StoredDoc)
}

export async function loadStoredDoc(id: string): Promise<{ doc: Doc; dirty: boolean } | null> {
  const v = (await get(key(id))) as StoredDoc | undefined
  return v ? { doc: parseDoc(v.doc), dirty: !!v.dirty } : null
}

export async function listStoredDocs(): Promise<StoredDoc[]> {
  const all = await entries()
  const out: StoredDoc[] = []
  for (const [k, v] of all) {
    if (typeof k !== 'string' || !k.startsWith('doc:')) continue
    try {
      const s = v as StoredDoc
      out.push({ doc: parseDoc(s.doc), updatedAt: s.updatedAt, dirty: !!s.dirty })
    } catch {
      /* skip corrupt entries */
    }
  }
  return out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function deleteStoredDoc(id: string): Promise<void> {
  await del(key(id))
  await del(`handle:${id}`)
}
