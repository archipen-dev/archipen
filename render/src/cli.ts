#!/usr/bin/env node
// archipen: render diagrams to SVG/PNG/PDF, or run the export server. `archipen --help` for usage.
import { mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { FORMATS, formatIssueLine, render, validateDiagram, type Format, type RenderOptions } from './index'
import { serve } from './server'

const HELP = `archipen: render Archipen diagrams without a browser

Usage:
  archipen export <file.archipen.json>... [options]
  archipen serve [--port 8080] [--base-path /tools/archipen-api]

Export options:
  -o, --out <path>       Output file, or a directory when exporting several files.
                         Without it the file is written to stdout.
  -f, --format <fmt>     svg | png | pdf. Default: from the --out extension, else svg.
      --theme <name>     light | dark (default light)
      --projection <p>   iso | 2d (default: as saved in the file)
      --page <id>        Export one page. Default: all pages (SVG with clickable links, PDF with one
                         page each); PNG shows the first page.
      --scale <n>        PNG pixel density, 0.1 to 8 (default 2)
      --padding <px>     Space around the diagram (default 32)
      --transparent      No background (PNG and SVG)
      --animate          Keep the flow animation on wires (SVG)
      --no-font          Don't embed the font in SVG (smaller file)
      --strict           Fail on warnings too

Serve options (also read from the PORT and BASE_PATH environment variables):
      --port <n>         Port to listen on (default 8080)
      --base-path <p>    URL path to serve under, e.g. /tools/archipen-api (default: root)

  -h, --help             Show this help
  -v, --version          Show the version
`

function fail(msg: string, code = 2): never {
  process.stderr.write(`archipen: ${msg}\n`)
  process.exit(code)
}

function num(v: string | undefined, name: string): number | undefined {
  if (v === undefined) return undefined
  const n = Number(v)
  if (!Number.isFinite(n)) fail(`--${name} must be a number`)
  return n
}

async function exportCmd(args: string[]) {
  const { values, positionals } = parseArgs({
    args,
    allowPositionals: true,
    options: {
      out: { type: 'string', short: 'o' },
      format: { type: 'string', short: 'f' },
      theme: { type: 'string' },
      projection: { type: 'string' },
      page: { type: 'string' },
      scale: { type: 'string' },
      padding: { type: 'string' },
      transparent: { type: 'boolean' },
      animate: { type: 'boolean' },
      'no-font': { type: 'boolean' },
      strict: { type: 'boolean' },
    },
  })
  if (!positionals.length) fail('no input file. Usage: archipen export <file.archipen.json> [-o out.png]')

  const out = values.out
  const many = positionals.length > 1
  const outIsDir = !!out && (many || /[\\/]$/.test(out) || (!extname(out) && !values.format) || isDir(out))
  if (many && !out) fail('several input files need --out <directory>')

  const extFormat = out && !outIsDir ? extname(out).slice(1).toLowerCase() : ''
  const format = (values.format ?? (extFormat || 'svg')).toLowerCase() as Format
  if (!FORMATS.includes(format)) fail(`unknown format "${format}" (use svg, png or pdf)`)
  if (values.theme && values.theme !== 'light' && values.theme !== 'dark') fail('--theme must be light or dark')
  if (values.projection && values.projection !== 'iso' && values.projection !== '2d') fail('--projection must be iso or 2d')

  const opts: RenderOptions = {
    theme: values.theme as RenderOptions['theme'],
    projection: values.projection as RenderOptions['projection'],
    page: values.page,
    scale: num(values.scale, 'scale'),
    padding: num(values.padding, 'padding'),
    background: !values.transparent,
    animate: values.animate,
    embedFont: !values['no-font'],
  }
  if (outIsDir) mkdirSync(out!, { recursive: true })

  let failed = false
  for (const file of positionals) {
    let text: string
    try {
      text = readFileSync(file, 'utf8')
    } catch (e) {
      process.stderr.write(`✗ ${file}: ${(e as Error).message}\n`)
      failed = true
      continue
    }
    const { doc, issues } = await validateDiagram(text)
    for (const i of issues) process.stderr.write(`  ${file}: ${formatIssueLine(i)}\n`)
    if (!doc || (values.strict && issues.length)) {
      process.stderr.write(`✗ ${file}: not exported\n`)
      failed = true
      continue
    }
    try {
      const bytes = await render(text, format, opts)
      if (!out) {
        process.stdout.write(bytes)
      } else {
        const target = outIsDir ? join(out, `${basename(file).replace(/(\.archipen)?\.json$/i, '')}.${format}`) : out
        writeFileSync(target, bytes)
        process.stderr.write(`✓ ${file} → ${target}\n`)
      }
    } catch (e) {
      process.stderr.write(`✗ ${file}: ${(e as Error).message}\n`)
      failed = true
    }
  }
  process.exit(failed ? 1 : 0)
}

function isDir(p: string) {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

async function serveCmd(args: string[]) {
  const { values } = parseArgs({ args, options: { port: { type: 'string' }, 'base-path': { type: 'string' } } })
  const port = num(values.port ?? process.env.PORT, 'port') ?? 8080
  const basePath = values['base-path'] ?? process.env.BASE_PATH ?? ''
  try {
    await serve({ port, basePath })
  } catch (e) {
    fail((e as Error).message, 1)
  }
}

const [cmd, ...rest] = process.argv.slice(2)
if (!cmd || cmd === '-h' || cmd === '--help' || cmd === 'help') {
  process.stdout.write(HELP)
} else if (cmd === '-v' || cmd === '--version') {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
  process.stdout.write(`${pkg.version}\n`)
} else if (cmd === 'export') {
  await exportCmd(rest).catch((e) => fail((e as Error).message))
} else if (cmd === 'serve') {
  await serveCmd(rest)
} else {
  fail(`unknown command "${cmd}". Try: archipen --help`)
}
