---
layout: home
hero:
  name: Archipen
  text: Isometric architecture diagrams in the browser
  tagline: No account and no server. Diagrams are plain JSON files on your disk, so you or an AI can write them by hand.
  actions:
    - theme: brand
      text: Open the app
      link: /app/
      target: _self
    - theme: alt
      text: File format
      link: /file-format
    - theme: alt
      text: Host it yourself
      link: /hosting
features:
  - title: Isometric or 2D
    details: One model, two projections. Switch with Shift+P.
  - title: Wires that route themselves
    details: Right-angle routing around blocks, parallel lanes, hops or gaps at crossings, and animated flow.
  - title: ~300 vendor logos
    details: Lucide icons, brand logos in their colours, or your own SVGs (sanitized on upload).
  - title: A file format made for people and AI
    details: Write only what differs from the defaults. A JSON Schema, a validator and a ready-made AI prompt come with it.
  - title: Share without uploading
    details: A share link carries the whole diagram in the URL fragment, which never reaches a server.
  - title: Export
    details: SVG (optionally animated), vector PDF with the font embedded, or PNG at 2× and 3×.
---

## What you can draw

- **Nodes** come in four shapes: block, cylinder, flat tile and icon only. Each has a size, a colour and an icon.
  An icon can sit flat on the top face, stand upright, or go on the left or right face.
- **Zones** are rectangles on the ground that nodes, notes and other zones sit inside. Moving a zone moves its contents.
- **Connections** are routed at right angles along the grid and around blocks. Wires that share a corridor are spread
  into parallel lanes. They can have arrows at either end, be solid, dashed or dotted, and show an animated **flow**.
  In isometric view, an arrowhead that must enter a hidden back face shows through the block as a faint "x-ray".
  A wire can also end on a **zone**, to point at a whole group.
- **Labels** for every item: choose the side, the alignment and the direction (facing the screen, flat on the ground,
  or standing along X or Y).
- **Texts and notes**, plus a **name and description** on every item.

## Working with diagrams

- **Style defaults** per diagram (Settings → Defaults) for nodes, zones, connections, text and notes. Items follow the
  defaults unless they set their own value; overrides show a dot in the item's panel and can be reset there.
- **Align and spread** a multi-selection along X or Y, and give selected nodes the same size.
- **Lock** items so they can't be moved or resized on the canvas, and **hide** items you don't want drawn or exported.
  Locking or hiding a zone covers everything inside it. A button in the top bar lists what's locked or hidden.
- **Templates** on the home page: web app, Kubernetes cluster, event-driven services, data pipeline and CI/CD.
  Each opens as an editable copy. They are the same files as the [examples](./examples).
- **Pages and drill-down.** A diagram can have several pages. Link a node or zone to a page (Properties → Link) and
  click it in view or present mode to open it; the page list or `Alt+←` leads back. PDF export includes every page.
- **Shared diagrams open read-only**, with a details panel for the item you click.
- **Present** (`P`): full screen with no UI. Click an item to highlight it and its connections, or a linked one to open
  its page.
- **Files:** diagrams are saved as `*.archipen.json` files and autosaved in your browser (IndexedDB).
- **Works offline** after the first visit, and can be installed as an app from the browser.
- **Export:**
  - SVG: with the font embedded, small without it, or with the flow animation. With several pages, one file holds
    all of them and linked items are clickable (or export just the page on screen)
  - PDF: vector, with the Instrument Sans font embedded, one PDF page per diagram page
  - PNG: at 2× or 3×, or with a transparent background
- **Share link:** copies a read-only link with the whole diagram compressed into the `#fragment`. Whoever opens it can
  view, present, or "Save a copy".

## Privacy and your data

Archipen runs entirely in your browser. There is no account, no server and no tracking: diagrams never leave your
machine unless you save, export or share them yourself. Keep in mind:

- **Autosave lives in this browser.** The app asks the browser to keep its storage, but clearing site data, a private
  window, or Safari's cleanup of sites you haven't visited for 7 days can still remove it. Save diagrams you care about
  as files.
- **Share links contain the whole diagram**. Anyone with the link can read
  it; the diagram is in the part after `#`, which browsers don't send to servers.

## Browsers

Current Chrome, Edge, Firefox and Safari. Share links need Safari 16.4 or Firefox 113 or newer
(`CompressionStream` with `deflate-raw`).

See [Controls](./controls) for the keyboard shortcuts, and [the file format](./file-format) to write diagrams by hand
or generate them with an AI.
