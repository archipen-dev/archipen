import { fileOpen, fileSave } from 'browser-fs-access'
import { del, get, set } from 'idb-keyval'
import { parseDoc } from '../model/defaults'
import type { Doc } from '../model/schema'

const EXT = '.archipen.json'
const handles = new Map<string, FileSystemFileHandle>()

const fileNameFor = (doc: Doc) => (doc.name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'diagram') + EXT

export async function openDiagramFile(): Promise<Doc> {
  const file = await fileOpen({ extensions: ['.json'], mimeTypes: ['application/json'], description: 'Archipen diagram', id: 'archipen' })
  let raw: unknown
  try {
    raw = JSON.parse(await file.text())
  } catch {
    throw new Error(`${file.name} is not valid JSON.`)
  }
  const doc = parseDoc(raw)
  if (file.handle) await rememberHandle(doc.id, file.handle)
  return doc
}

/** Parse a dropped/picked File into a diagram. */
export async function readDiagramFile(file: File): Promise<Doc> {
  return parseDoc(JSON.parse(await file.text()))
}

export async function rememberHandle(docId: string, handle: FileSystemFileHandle) {
  handles.set(docId, handle)
  try {
    await set(`handle:${docId}`, handle)
  } catch {
    /* handles may not be cloneable in some browsers */
  }
}

async function handleFor(docId: string): Promise<FileSystemFileHandle | null> {
  if (handles.has(docId)) return handles.get(docId)!
  try {
    const h = (await get(`handle:${docId}`)) as FileSystemFileHandle | undefined
    if (h) handles.set(docId, h)
    return h ?? null
  } catch {
    return null
  }
}

export function serialize(doc: Doc): string {
  return JSON.stringify(doc, null, 2)
}

/** Save to disk. Re-uses the file the diagram was opened from/saved to unless `saveAs`. */
export async function saveDiagramFile(doc: Doc, saveAs = false): Promise<string | null> {
  const blob = new Blob([serialize(doc)], { type: 'application/json' })
  const existing = saveAs ? null : await handleFor(doc.id)
  const handle = await fileSave(blob, { fileName: fileNameFor(doc), extensions: ['.json'], description: 'Archipen diagram', id: 'archipen' }, existing)
  if (handle) await rememberHandle(doc.id, handle)
  return handle?.name ?? fileNameFor(doc)
}

export async function forgetHandle(docId: string) {
  handles.delete(docId)
  await del(`handle:${docId}`).catch(() => {})
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export const baseName = (doc: Pick<Doc, 'name'>) => doc.name.trim().replace(/[\\/:*?"<>|]+/g, '-') || 'diagram'
