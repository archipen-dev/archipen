// Vite plugin: write THIRD-PARTY-NOTICES.txt next to the build, with the licence of every npm package whose code
// ends up in the bundle. MIT, ISC, BSD and Apache-2.0 all ask for their notice to travel with copies of the code.
// Packages left external (not bundled) are installed with their own licence files, so they aren't listed.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const LICENSE_FILE = /^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i

/** "/repo/node_modules/@scope/pkg/dist/x.js" → "/repo/node_modules/@scope/pkg" (innermost node_modules wins). */
function packageDir(id) {
  const clean = id.replace(/^\0/, '').split('?')[0]
  const at = clean.lastIndexOf('/node_modules/')
  if (at < 0) return null
  const rest = clean.slice(at + '/node_modules/'.length).split('/')
  const name = rest[0].startsWith('@') ? `${rest[0]}/${rest[1]}` : rest[0]
  return join(clean.slice(0, at), 'node_modules', name)
}

function notice(dir) {
  const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const files = readdirSync(dir).filter((f) => LICENSE_FILE.test(f)).sort()
  const texts = files.map((f) => readFileSync(join(dir, f), 'utf8').trim())
  const license = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? 'see package')
  const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name
  const body = texts.length ? texts.join('\n\n') : `License: ${license}${author ? `, copyright ${author}` : ''} (the package ships no licence file)`
  return { name: pkg.name, text: `${pkg.name} ${pkg.version} (${license})\n${pkg.repository?.url ?? pkg.homepage ?? ''}\n\n${body}` }
}

/** @param {{ title: string }} options */
export function thirdPartyNotices({ title }) {
  return {
    name: 'archipen-third-party-notices',
    apply: 'build',
    generateBundle(_options, bundle) {
      const dirs = new Set()
      for (const item of Object.values(bundle)) {
        // Fonts and images pulled in through CSS show up as assets, not as modules of a chunk.
        const ids = item.type === 'chunk' ? item.moduleIds : (item.originalFileNames ?? [])
        for (const id of ids) {
          const dir = packageDir(id)
          if (dir && existsSync(join(dir, 'package.json'))) dirs.add(dir)
        }
      }
      // A package found under a nested node_modules may be listed with its own version; keep both.
      const entries = [...dirs].map(notice).sort((a, b) => a.name.localeCompare(b.name) || a.text.localeCompare(b.text))
      const unique = entries.filter((e, i) => i === 0 || e.text !== entries[i - 1].text)
      const header = `${title}\n${'='.repeat(title.length)}\n\nThis build contains code from the following packages. Their licences are reproduced below.\n`
      this.emitFile({
        type: 'asset',
        fileName: 'THIRD-PARTY-NOTICES.txt',
        source: [header, ...unique.map((e) => e.text)].join(`\n\n${'-'.repeat(78)}\n\n`) + '\n',
      })
    },
  }
}
