import { sanitizeSvg } from '../icons/sanitize'
import { newId } from '../model/ids'
import { toast } from '../store/toastStore'
import { addAsset } from './document'

export interface ImportedIcon {
  /** Icon reference for a node: `custom:<asset id>`. */
  ref: string
  name: string
}

const nameOf = (file: File) => file.name.replace(/\.svg$/i, '')

export const isSvgFile = (f: File) => f.name.toLowerCase().endsWith('.svg') || f.type === 'image/svg+xml'

/** Sanitise SVG files and add them to the document's icons. Files that fail are reported and skipped. */
export async function importSvgIcons(files: Iterable<File>): Promise<ImportedIcon[]> {
  const out: ImportedIcon[] = []
  for (const file of files) {
    try {
      const id = newId('a')
      addAsset(sanitizeSvg(await file.text(), id, nameOf(file)))
      out.push({ ref: `custom:${id}`, name: nameOf(file) })
    } catch (err) {
      toast(`${file.name}: ${(err as Error).message}`, 'error')
    }
  }
  return out
}
