# @archipen/mcp

An [MCP](https://modelcontextprotocol.io) server that lets an AI client, like Claude Code or Claude Desktop, read and
edit the diagram open in the [Archipen](https://archipen.dev/) editor in your browser. Changes show
up at once, and you undo them like your own.

The AI client starts the server over stdio; your editor tab connects to it on `ws://127.0.0.1:7331` after you open a
pairing link. Nothing leaves your computer except what the AI client itself sends.

## Set up

Node.js 22 or newer.

```sh
claude mcp add archipen -- npx -y @archipen/mcp     # Claude Code
```

Claude Desktop (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "archipen": { "command": "npx", "args": ["-y", "@archipen/mcp"] }
  }
}
```

Then ask the AI to "connect to Archipen" and open the pairing link it gives you.

## Settings

| Variable | Default | |
|---|---|---|
| `ARCHIPEN_APP_URL` | `https://archipen.dev/app/` | Where the app runs; the pairing link opens it. |
| `ARCHIPEN_MCP_PORT` | `7331` | Port the editor connects to. |
| `ARCHIPEN_MCP_ORIGINS` | localhost dev ports, `https://archipen.dev` and the origin of `ARCHIPEN_APP_URL` | Sites allowed to connect, comma-separated. |
| `ARCHIPEN_MCP_TOKEN` | random | A fixed pairing token, so a paired tab survives restarts. |

Full guide, tools and browser notes: <https://archipen.dev/mcp>.

## License

MIT. Third-party notices are in `dist/THIRD-PARTY-NOTICES.txt`.
