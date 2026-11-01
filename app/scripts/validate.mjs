// Check Archipen diagram files: npm run validate -- file.archipen.json [more files…]
// Prints every error and warning. Exit code 1 if any file has errors (or with --strict, warnings).
import { readFileSync } from 'node:fs'
import { load } from './load.mjs'

const args = process.argv.slice(2)
const strict = args.includes('--strict')
const files = args.filter((a) => a !== '--strict')
if (!files.length) {
  console.error('Usage: npm run validate -- [--strict] <file.archipen.json>…')
  process.exit(2)
}

const { validateDoc, formatIssue } = await load('/src/model/parse.ts')
let failed = false
for (const file of files) {
  let raw
  try {
    raw = JSON.parse(readFileSync(file, 'utf8'))
  } catch (e) {
    console.log(`✗ ${file}\n  error: not valid JSON: ${e.message}`)
    failed = true
    continue
  }
  const { doc, issues } = validateDoc(raw)
  const bad = !doc || (strict && issues.length > 0)
  failed ||= bad
  const count = (p) => `${p.nodes.length} nodes, ${p.zones.length} zones, ${p.edges.length} wires, ${p.texts.length} texts`
  const counts = !doc ? 'not loadable' : doc.pages.length === 1 ? count(doc.pages[0]) : doc.pages.map((p) => `${p.id}: ${count(p)}`).join('; ')
  console.log(`${bad ? '✗' : '✓'} ${file} (${counts})`)
  for (const i of issues) console.log(`  ${i.level}: ${formatIssue(i)}`)
}
process.exit(failed ? 1 : 0)
