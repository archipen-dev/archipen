// Build the GitHub Pages site: the VitePress docs, with the app, the JSON Schema, the examples and the agent skill
// (archipen-skill.zip, for uploading to claude.ai) next to them.
//   npm run site:build            → docs/.vitepress/dist/  (base from DOCS_BASE, default /)
// The app is the normal build; it runs under any path, so it is just copied to <site>/app/.
import { execSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const at = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url))
const run = (cmd) => execSync(cmd, { cwd: root, stdio: 'inherit' })

run('npm run build -w app')
run('npm run build -w docs')

const site = at('docs/.vitepress/dist/')
if (!existsSync(site)) throw new Error(`VitePress did not write ${site}`)
cpSync(at('app/dist/'), `${site}app/`, { recursive: true })
cpSync(at('schema/'), `${site}schema/`, { recursive: true })
// Served at https://archipen.dev/schema/archipen.schema.json, the schema's $id: editors fetch it from there.
if (!existsSync(`${site}schema/archipen.schema.json`)) throw new Error('The JSON Schema is missing from the site')
cpSync(at('examples/'), `${site}examples/`, { recursive: true })
execSync(`zip -qr ${site}archipen-skill.zip archipen`, { cwd: at('skills/'), stdio: 'inherit' })
console.log(`\nSite written to docs/.vitepress/dist/ (base ${process.env.DOCS_BASE ?? '/'})`)
