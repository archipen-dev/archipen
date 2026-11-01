// Copy the diagram fonts into render/fonts/, so the published package doesn't need the app sources, and the vendor
// logo credits into render/, since the bundle contains the logos and some of their licences ask for attribution.
import { copyFileSync, mkdirSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, '../fonts')
const appFonts = join(here, '../../app/src/assets/fonts')
const require = createRequire(join(here, '../../app/package.json'))
const woff2 = require.resolve('@fontsource-variable/instrument-sans/files/instrument-sans-latin-wght-normal.woff2')

mkdirSync(out, { recursive: true })
for (const f of ['InstrumentSans-Regular.ttf', 'InstrumentSans-SemiBold.ttf', 'OFL.txt']) copyFileSync(join(appFonts, f), join(out, f))
copyFileSync(woff2, join(out, 'InstrumentSans-Variable.woff2'))
copyFileSync(join(here, '../../app/public/vendor-icon-credits.txt'), join(here, '../vendor-icon-credits.txt'))
