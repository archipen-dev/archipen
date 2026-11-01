# @archipen/render

Render [Archipen](https://archipen.dev/) diagrams (`.archipen.json`) to SVG, PNG and PDF without a browser. You can
use it from the command line, from Node, or as an HTTP server.

```sh
npx @archipen/render export diagram.archipen.json -o diagram.png   # or: npm install -g @archipen/render
```

```js
import { renderPng } from '@archipen/render'
const png = await renderPng(readFileSync('diagram.archipen.json', 'utf8'), { theme: 'dark', scale: 2 })
```

```sh
archipen serve --port 8080 --base-path /tools/archipen-api
curl -X POST --data-binary @diagram.archipen.json 'localhost:8080/tools/archipen-api/export?format=pdf' -o diagram.pdf
```

Node.js 22 or newer. Run `archipen --help` for all options. Full guide: <https://archipen.dev/export>.

Fonts: Instrument Sans, SIL Open Font License (`fonts/OFL.txt`). Vendor logos: Simple Icons, credited in
`vendor-icon-credits.txt`; the logos are trademarks of their owners. Bundled third-party code: `dist/THIRD-PARTY-NOTICES.txt`.
