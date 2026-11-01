// Load a TypeScript module from src/ in plain node, via Vite (no extra dependencies).
import { runnerImport } from 'vite'
import { fileURLToPath } from 'node:url'

/** The app package (app/). */
export const root = fileURLToPath(new URL('..', import.meta.url))
/** The repository root: schema/, examples/ and docs/ live here. */
export const repoRoot = fileURLToPath(new URL('../..', import.meta.url))

export async function load(path) {
  const { module } = await runnerImport(path, { configFile: false, root, logLevel: 'error' })
  return module
}
