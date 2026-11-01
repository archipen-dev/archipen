// Regenerate schema/archipen.schema.json, the icon list in docs/file-format.md and the agent skill in skills/archipen/ from src/.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { load, repoRoot } from './load.mjs'

const { jsonSchemaText, SCHEMA_PATH, DOCS_PATH, withIconList } = await load('/src/model/jsonSchema.ts')
const out = join(repoRoot, SCHEMA_PATH)
mkdirSync(dirname(out), { recursive: true })
writeFileSync(out, jsonSchemaText())
console.log(`Wrote ${SCHEMA_PATH}`)

const docs = join(repoRoot, DOCS_PATH)
writeFileSync(docs, withIconList(readFileSync(docs, 'utf8')))
console.log(`Updated the icon list in ${DOCS_PATH}`)

const { skillFiles, SKILL_DIR } = await load('/src/model/skill.ts')
for (const [path, text] of Object.entries(skillFiles((p) => readFileSync(join(repoRoot, p), 'utf8')))) {
  mkdirSync(dirname(join(repoRoot, path)), { recursive: true })
  writeFileSync(join(repoRoot, path), text)
}
console.log(`Updated the agent skill in ${SKILL_DIR}/`)
