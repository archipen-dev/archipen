# Archipen

[![CI](https://github.com/archipen-dev/archipen/actions/workflows/ci.yml/badge.svg)](https://github.com/archipen-dev/archipen/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue)](LICENSE)

Isometric architecture diagrams in the browser. No server: diagrams are saved as
`*.archipen.json` files on your disk and autosaved to IndexedDB. It works offline and can be installed as an app.

The documentation is in [`docs/`](docs/): the [features](docs/index.md), the [controls](docs/controls.md), the
[file format](docs/file-format.md) and [hosting](docs/hosting.md). It is also published at <https://archipen.dev/>,
with a live copy of the app at <https://archipen.dev/app/>, by `.github/workflows/pages.yml`.

```sh
npm install
npm run dev          # the editor, http://localhost:5173
npm run lint         # oxlint
npm test             # unit tests (vitest)
npm run e2e          # browser tests (Playwright)
npm run build        # app/dist/: static files that run under any URL path
npm run docs:dev     # the documentation site
npm run site:build   # docs + app for GitHub Pages, in docs/.vitepress/dist/
```

To self-host, serve `app/dist/` from any static server, or use the Docker image:

```sh
docker run -p 8080:8080 -e BASE_PATH=/tools/archipen ghcr.io/archipen-dev/archipen   # PORT and BASE_PATH are read at start
```

The images (`ghcr.io/archipen-dev/archipen` and `ghcr.io/archipen-dev/archipen-render`) run as a non-root user with
no capabilities and a read-only root filesystem, so they fit the Kubernetes "restricted" policy. `scripts/docker-smoke.sh` checks this in CI. See [docs/hosting.md](docs/hosting.md) for details.

## Export without a browser

`render/` (`@archipen/render`) renders diagrams to SVG, PNG and PDF in plain Node. It has a command line, a Node API and
an optional HTTP export server, and draws with the same code as the app's Export menu. See
[docs/export.md](docs/export.md).

```sh
npm run export -- examples/web-shop.archipen.json -o web-shop.png       # the command line
docker run -p 8080:8080 ghcr.io/archipen-dev/archipen-render           # the HTTP server (PORT, BASE_PATH)
```

## Edit with AI (MCP)

`mcp/` (`@archipen/mcp`) is an MCP server that lets an AI client such as Claude Code read and edit the diagram open in
the browser. The editor tab connects to it on `127.0.0.1` after you open a pairing link, and every change can be
undone. See [docs/mcp.md](docs/mcp.md).

```sh
claude mcp add archipen -- npx -y @archipen/mcp
```

## File format

Diagrams are plain JSON, so you or an AI can write them by hand. See [docs/file-format.md](docs/file-format.md) for
the rules, the [JSON Schema](schema/archipen.schema.json), the [examples](examples/), and a ready-made prompt for AI
generation. For AI agents there is a skill in [`skills/archipen`](skills/archipen/) (in Claude Code:
`/plugin install archipen --marketplace archipen-dev/archipen`).

```sh
npm run validate -- my.archipen.json   # list errors and warnings (--strict also fails on warnings)
npm run schema                         # regenerate the JSON Schema after changing app/src/model/schema.ts
```

## Layout

This is an npm workspace with four packages, `app`, `render`, `mcp` and `docs`.

- `app/`: the editor (Vite, React, TanStack Router with hash routes).
  - `src/model`: the zod file schema, defaults, file loading and checks, and pure document operations
    (entities, membership, arrange, lock/hide). No React, no stores.
  - `src/geometry`: projection, viewport math, routing, crossings, label layout and scene building. Pure functions with
    unit tests.
  - `src/render`: the SVG drawing, one file per shape in `render/shapes`. The same components draw the canvas and the
    exports.
  - `src/export`: builds the standalone export SVG as a string, without a DOM (shared with `render/`).
  - `src/io`: files, autosave, share links, and the export formats (`io/exporters.ts`, one strategy per format).
  - `src/store`: zustand stores: the document with undo history, UI state, preferences, toasts, theme.
  - `src/commands`: every change to the document or view, as named functions (`addNode`, `toggleFlag`, `fitAll`…).
    Components call these and never write to the stores themselves.
  - `src/keyboard`: shortcuts as one ordered table of bindings (`keymap.ts`); the shortcuts dialog is built from it.
  - `src/ui`: presentational primitives (buttons, fields, panels, menus). They don't read stores.
  - `src/features`: the screens and panels, one folder each: `canvas` (each drag is a gesture strategy in
    `canvas/gestures`), `editor` (layout and the actions provider), `topbar`, `toolbar`, `properties`, `details`,
    `dialogs`, `icon-picker`, `style-fields`, `documents` (open/save/export/share) and `home`. A feature
    imports another only through its `index.ts`; the editor's children may also use `editor/EditorActions`.
  - `src/routes`: TanStack routes, kept thin: search params, loading, then a feature.
  - `scripts/`: schema generation, the validator, the vendor icon import, and `bench-scene.mjs`, which times scene
    builds and drag frames on generated diagrams (`node app/scripts/bench-scene.mjs`).
  - `e2e/`: Playwright tests.
- `render/`: the headless renderer (`@archipen/render`): CLI, Node API and HTTP export server, built with
  `vite build --ssr` from the app's sources. `render/Dockerfile` is the export server image.
- `mcp/`: the MCP server (`@archipen/mcp`): stdio MCP tools plus the WebSocket bridge to the editor tab, built with
  `vite build --ssr` like `render/`. The tab's side is `app/src/io/aiBridge.ts` and `app/src/commands/bridge.ts`; the
  messages between them are in `app/src/io/bridgeProtocol.ts`.
- `docs/`: the documentation, built with VitePress (`docs/.vitepress/config.ts`).
- `schema/`, `examples/`: the JSON Schema and example diagrams, shared by the app, its tests and the docs.
- `deploy/Caddyfile`, `Dockerfile`: the self-hosting image.
- `scripts/site.mjs`: assembles the GitHub Pages site.

## Contributing

Issues and pull requests are welcome. Report security problems privately through
[GitHub security advisories](https://github.com/archipen-dev/archipen/security/advisories/new); see
[SECURITY.md](SECURITY.md).

## Credits

Vendor logos come from [Simple Icons](https://simpleicons.org). Most are CC0; the few under Apache-2.0 or CC-BY are
credited in [app/public/vendor-icon-credits.txt](app/public/vendor-icon-credits.txt). The logos are trademarks of their
respective owners. The PDF and PNG exports embed Instrument Sans (OFL, `app/src/assets/fonts`). Every build writes
`THIRD-PARTY-NOTICES.txt` into its `dist/` folder with the licences of the bundled npm packages
(`scripts/vite-notices.mjs`); it is served with the app and shipped in the `@archipen/render` package and both images.

## License

[MIT](LICENSE). The bundled fonts and vendor logos keep their own licences, listed under Credits above.
