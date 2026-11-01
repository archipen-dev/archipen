import instrumentSansUrl from '@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2?url'
import { fontFaceRule } from '../export/fontCss'

async function toBase64(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Could not load font (${res.status})`)
  const bytes = new Uint8Array(await res.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}

let cssPromise: Promise<string> | null = null

/** `@font-face` rule with the diagram font inlined, so exported SVG/PNG render identically anywhere. */
export function fontFaceCss(): Promise<string> {
  cssPromise ??= toBase64(instrumentSansUrl)
    .then(fontFaceRule)
    .catch((err) => {
      cssPromise = null
      throw err
    })
  return cssPromise
}

export { toBase64 as fetchBase64 }
