# Edit with AI (MCP)

An AI client that speaks [MCP](https://modelcontextprotocol.io), like Claude Code or Claude Desktop, can read and change
the diagram open in your browser. Its changes show up at once, and you undo them like your own (<kbd>Ctrl</kbd>+<kbd>Z</kbd>).

It works through a small local server, the npm package [`@archipen/mcp`](https://www.npmjs.com/package/@archipen/mcp). The AI client starts it, and your editor tab connects
to it over a WebSocket on `127.0.0.1`. Nothing leaves your computer except what the AI client itself sends.

```
AI client ⇄ stdio ⇄ archipen MCP server ⇄ ws://127.0.0.1:7331 ⇄ the editor tab
```

## Set up

You need Node.js 22 or newer. The AI client starts the server with `npx`, which downloads it on first use.

```sh
claude mcp add archipen -- npx -y @archipen/mcp     # Claude Code
```

For Claude Desktop, add the server to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "archipen": {
      "command": "npx",
      "args": ["-y", "@archipen/mcp"]
    }
  }
}
```

The pairing link opens the hosted app at `https://archipen.dev/app/`. To use a self-hosted or
local copy, set `ARCHIPEN_APP_URL` (see [Settings](#settings)), e.g. `claude mcp add archipen -e
ARCHIPEN_APP_URL=http://localhost:5173/ -- npx -y @archipen/mcp`.

To run the server from a clone instead (when working on it): `npm install && npm run build:mcp`, then
`claude mcp add archipen -- node "$PWD/mcp/dist/cli.mjs"`.

## Connect the editor

Ask the AI to "connect to Archipen". It gets a pairing link and a pairing code from the `connection_status` tool.
There are two ways to pair a tab:

- **Open the link.** It opens the app on the start page and connects that tab. Then ask the AI to create a diagram,
  or to open one of the diagrams saved in this browser; the tab follows.
- **Paste the code** to keep the diagram you are working on: click the robot button in the editor's top bar and
  paste the code (`7331.Ab3x…`) or the whole link.

The robot button shows the connection; its menu has **Disconnect** and **Pair with a new code…**.

The pairing lasts until you close the tab. The server makes a new token each time it starts, so after a restart
you need a new link. Set `ARCHIPEN_MCP_TOKEN` to keep the same one.

Only one tab is connected at a time: opening the link in another tab takes the connection over.

## What the AI can do

| Tool | What it does |
|---|---|
| `connection_status` | Whether a tab is connected, what it shows (a diagram, or the start page), and the pairing link and code. |
| `new_diagram` | Creates a diagram in the browser, empty or from a full document, and opens it in the tab. |
| `list_diagrams` | The diagrams saved in the browser. |
| `open_diagram` | Opens one of them in the tab. |
| `get_diagram` | The open diagram as [file format](file-format.md) JSON, its revision, the page on screen and the selection. |
| `patch_diagram` | Changes the diagram with [JSON Patch](https://www.rfc-editor.org/rfc/rfc6902) operations. |
| `replace_diagram` | Replaces the whole diagram. |
| `validate_diagram` | Lists errors and warnings, like `npm run validate`. |
| `render_preview` | A PNG of a page, so the AI can see its layout. |
| `get_file_format` | This documentation's [file format](file-format.md) page. Also the resources `archipen://file-format` and `archipen://schema`. |

Every change is checked before it reaches the editor: an invalid diagram is refused with the list of errors, and the
editor is left as it was. A change with `expectRevision` is also refused when you edited the diagram since the AI
read it. The AI can't change a diagram opened from a share link, or one you are presenting.

When the AI opens or creates a diagram, the one on screen stays saved in the browser, as when you switch diagrams
yourself. It doesn't ask "Leave anyway?" for changes not saved to a file: they are still in the browser, and the
diagram is in the start page's list.

## Settings

The server reads these environment variables:

| Variable | Default | |
|---|---|---|
| `ARCHIPEN_MCP_PORT` | `7331` | Port the editor connects to. |
| `ARCHIPEN_APP_URL` | `https://archipen.dev/app/` | Where the app runs; the pairing link opens it. |
| `ARCHIPEN_MCP_ORIGINS` | `http://localhost:5173`, `http://localhost:4173`, `https://archipen.dev` and the origin of `ARCHIPEN_APP_URL` | Sites allowed to connect, comma-separated. `*` allows any (the token is still needed). |
| `ARCHIPEN_MCP_TOKEN` | random | A fixed pairing token. |

For a self-hosted copy, set `ARCHIPEN_APP_URL` to its address; its origin is then allowed too.

## Browsers

| | Run locally (`http://localhost`) | Hosted (`https://…`) |
|---|---|---|
| Chrome, Edge, Firefox | Works | Works. Chrome may ask to allow access to devices on your local network: allow it. |
| Safari, any browser on iOS | Works | Blocked in some versions: WebKit may refuse to let an https page connect to `ws://127.0.0.1`. |

When the connection fails, the app says why, in a message and in the robot icon's menu:

- **"This browser blocks connections from this page to local AI tools."** Use Chrome or Firefox, or run Archipen
  locally (`npm run dev`, then set `ARCHIPEN_APP_URL=http://localhost:5173/`). In Safari on an https page a blocked
  connection looks the same as a server that isn't running, so there the message says the browser *may* block it,
  and the app keeps trying.
- **"Can't reach the Archipen MCP server on port …"** The server isn't running, or listens on another port. The app
  keeps trying; the menu has **Try again**.
- **"… refused this pairing link"** The server restarted with a new token. Ask the AI for a new link.
- **"… doesn't allow this site"** Add the site's origin to `ARCHIPEN_MCP_ORIGINS`.

## Security

- The server listens on `127.0.0.1` only.
- A tab must present the token from the pairing link, and come from an allowed origin. Other sites you visit can't
  connect, read your diagram, or feed the AI content.
- The editor checks every change again before applying it, and cleans custom icon markup like any opened file.
- The app's Content-Security-Policy allows `ws://127.0.0.1:*` and no other outside connection.
