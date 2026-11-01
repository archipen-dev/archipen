# Export without a browser

The app's **Export** menu runs in the browser. To make the same SVG, PNG and PDF files in a script, a CI job or a
backend, use the `@archipen/render` package. It needs only Node.js, with no browser, Playwright or screenshots.

- The SVG is identical to the app's export, because both use the same drawing code.
- PNG is rasterised with [resvg](https://github.com/RazrFalcon/resvg) and the bundled Instrument Sans font, so it looks
  the same on every machine. System fonts are never used.
- PDF is vector, with the font embedded: one PDF page per diagram page, each the size of its drawing. Empty pages are
  left out.
- Diagrams with several pages: see [Pages](#pages).

There are three ways to use it: the [command line](#command-line), the [Node API](#node-api) and an
[HTTP server](#http-api).

## Pages

A diagram with several pages exports like this, in the app and here alike:

| Format | All pages (default) | One page (`--page <id>`, or "This page" in the app) |
|---|---|---|
| SVG | One file with every page. Clicking a linked node or zone shows its page; a "‹ first page" link and the browser's Back button lead back. | That page, no links. |
| PDF | One PDF page per diagram page. | That page. |
| PNG | The first page (the app: the page on screen). | That page. |

The clickable SVG needs no script: each page is a nested `<svg id="ap-page-<page id>">`, and CSS `:target` shows the one
named in the URL fragment, so `diagram.svg#ap-page-checkout` opens on that page. Clicking only works where the SVG is
a document of its own: opened directly in a browser, inlined in HTML, or embedded with `<object>` or `<iframe>`. As an
`<img>` (GitHub READMEs and most documentation tools) it shows the first page and nothing is clickable; export single
pages for those.

## Install

You need Node.js 22 or newer.

```sh
npx @archipen/render export diagram.archipen.json -o diagram.png   # run once, without installing
npm install -g @archipen/render                                     # or put the archipen command on your PATH
archipen export diagram.archipen.json -o diagram.png
npm install @archipen/render                                        # or use the Node API in a project
```

From a clone of the repository:

```sh
npm ci
npm run export -- examples/web-shop.archipen.json -o web-shop.png
```

## Command line

```text
archipen export <file.archipen.json>... [options]
archipen serve [--port 8080] [--base-path /tools/archipen-api]
```

| Option | Meaning |
|---|---|
| `-o, --out <path>` | Output file. A directory when exporting several files. Without it the file goes to stdout. |
| `-f, --format <fmt>` | `svg`, `png` or `pdf`. Defaults to the extension of `--out`, else `svg`. |
| `--theme <name>` | `light` (default) or `dark`. |
| `--projection <p>` | `iso` or `2d`. Defaults to the projection saved in the file. |
| `--page <id>` | Export just this page. Without it, SVG and PDF contain every page (see [Pages](#pages)) and PNG shows the first page. |
| `--scale <n>` | PNG pixel density, `0.1` to `8` (default `2`). Very large diagrams are scaled down to stay within 16384 px. |
| `--padding <px>` | Space around the diagram (default `32`). |
| `--transparent` | No background (PNG and SVG). |
| `--animate` | Keep the flow animation on wires (SVG). |
| `--no-font` | Don't embed the font in the SVG (about 40 KB smaller). Viewers without Instrument Sans fall back to Helvetica/Arial. |
| `--strict` | Also fail on warnings. |

Before rendering, the file is checked the same way as `npm run validate`. Errors and warnings go to stderr. The exit code
is `1` if any file could not be exported, and `2` for wrong usage.

```sh
# one file; the format comes from the extension
archipen export diagram.archipen.json -o diagram.pdf

# dark PNG at 3× density
archipen export diagram.archipen.json -o diagram@3x.png --theme dark --scale 3

# top-down plan as SVG, to stdout
archipen export diagram.archipen.json --projection 2d > plan.svg

# every diagram in a folder, as PNG into out/
archipen export diagrams/*.archipen.json -o out/ -f png
```

## Node API

```js
import { readFileSync, writeFileSync } from 'node:fs'
import { renderPdf, renderPng, renderSvg, DiagramError } from '@archipen/render'

const diagram = readFileSync('diagram.archipen.json', 'utf8') // JSON text, a parsed object, or bytes

try {
  writeFileSync('diagram.svg', await renderSvg(diagram))
  writeFileSync('diagram.png', await renderPng(diagram, { theme: 'dark', scale: 2 }))
  writeFileSync('diagram.pdf', await renderPdf(diagram))
} catch (e) {
  if (e instanceof DiagramError) console.error(e.issues) // [{ level, path, message }, …]
  else throw e
}
```

| Function | Returns |
|---|---|
| `renderSvg(input, options?)` | `Promise<string>` |
| `renderPng(input, options?)` | `Promise<Buffer>` |
| `renderPdf(input, options?)` | `Promise<Buffer>` |
| `render(input, format, options?)` | `Promise<Buffer>` for `'svg' \| 'png' \| 'pdf'` |
| `validateDiagram(input)` | `Promise<{ doc, issues }>`, never throws; `doc` is `null` when there are errors |

The options match the command-line flags: `theme`, `projection`, `page`, `scale`, `padding`, `background` (`false` =
transparent), `animate` and `embedFont`. TypeScript types are included.

## HTTP API

`archipen serve` starts a small HTTP server for apps that can't run Node themselves. It's a separate process from the
static app, and GitHub Pages can't host it. See [Hosting → Export server](./hosting#export-server) for running it with
Docker or behind a proxy.

All routes are under the configured base path (empty by default). The examples below use `/tools/archipen-api`.

### `POST {base}/export`

Send the diagram JSON as the request body. The response is the rendered file.

| Query parameter | Values | Default |
|---|---|---|
| `format` | `svg`, `png`, `pdf` | `svg` |
| `theme` | `light`, `dark` | `light` |
| `projection` | `iso`, `2d` | from the file |
| `page` | a page id | all pages (SVG, PDF); first page (PNG) |
| `scale` | `0.1` to `8` (PNG) | `2` |
| `padding` | `0` to `1000` | `32` |
| `transparent` | `1` for no background | off |
| `animate` | `1` to keep the flow animation (SVG) | off |
| `font` | `0` to not embed the font (SVG) | embedded |

```sh
curl -X POST --data-binary @diagram.archipen.json \
  'https://example.com/tools/archipen-api/export?format=png&theme=dark' -o diagram.png
```

```js
const res = await fetch('https://example.com/tools/archipen-api/export?format=pdf', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(diagram),
})
if (!res.ok) throw new Error((await res.json()).error)
const pdf = await res.arrayBuffer()
```

A successful response has a `Content-Disposition` file name taken from the diagram's name, e.g. `Web shop.png`.

| Status | Meaning | Body |
|---|---|---|
| `200` | Rendered | The file |
| `400` | Invalid JSON, invalid diagram, or a bad query parameter | `{ "error": "…", "issues": [{ "level", "path", "message" }] }` (`issues` only for invalid diagrams) |
| `405` | Not a `POST` | `{ "error": "…" }` |
| `413` | Body larger than 5 MB | `{ "error": "…" }` |
| `422` | The diagram has nothing to draw, is too large (over 100 000 px a side or over `MAX_ITEMS` items), or took longer than `RENDER_TIMEOUT_MS` | `{ "error": "…" }` |
| `503` | All render threads are busy and the queue is full. Retry after the `Retry-After` seconds | `{ "error": "…" }` |

### Other routes

| Route | Response |
|---|---|
| `GET {base}/healthz` | `ok`, for health checks |
| `GET {base}/` | A short usage text |
| `{base}` without the trailing slash | `308` redirect to `{base}/` |

Every other path returns `404`.
