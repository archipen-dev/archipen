import { readdirSync, readFileSync } from 'node:fs'
import { deflateRawSync } from 'node:zlib'
import { defineLoader } from 'vitepress'

// Build-time data for examples.md: every file in ../examples, plus the payload of a read-only
// share link (the same encoding as app/src/io/shareLink.ts: "1." + base64url(deflate-raw(JSON))).
export interface Example {
  file: string
  name: string
  nodes: number
  zones: number
  edges: number
  pages: number
  share: string
}

declare const data: Example[]
export { data }

const dir = new URL('../examples/', import.meta.url)

export default defineLoader({
  watch: ['../examples/*.json'],
  load(): Example[] {
    return readdirSync(dir)
      .filter((f) => f.endsWith('.archipen.json'))
      .map((file) => {
        const text = readFileSync(new URL(file, dir), 'utf8')
        const doc = JSON.parse(text)
        const pages: Record<string, unknown[] | undefined>[] = doc.pages ?? []
        const total = (k: string) => pages.reduce((n, p) => n + (p[k]?.length ?? 0), 0)
        return {
          file,
          name: doc.name ?? file,
          nodes: total('nodes'),
          zones: total('zones'),
          edges: total('edges'),
          pages: pages.length,
          share: `1.${deflateRawSync(JSON.stringify(doc)).toString('base64url')}`,
        }
      })
      .sort((a, b) => a.nodes - b.nodes)
  },
})
