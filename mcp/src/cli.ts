#!/usr/bin/env node
// Archipen MCP server: speaks MCP on stdin/stdout and waits for an editor tab on ws://127.0.0.1:<port>.
// Settings (environment):
//   ARCHIPEN_MCP_PORT     port for the editor tab (default 7331)
//   ARCHIPEN_MCP_ORIGINS  comma-separated origins allowed to connect ("*" for any)
//   ARCHIPEN_MCP_TOKEN    fixed pairing token, so a paired tab survives restarts (default: random each start)
//   ARCHIPEN_APP_URL      where the app runs; the pairing link opens it (default: the hosted app, APP_URL below)
// stdout belongs to MCP: everything for people goes to stderr.
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { DEFAULT_BRIDGE_PORT, pairingLink } from '../../app/src/io/bridgeProtocol'
import { Bridge } from './bridge'
import { createServer } from './tools'

export const APP_URL = 'https://archipen.dev/app/'
export const DEFAULT_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'https://archipen.dev']

const env = process.env
const appUrl = env.ARCHIPEN_APP_URL || APP_URL
const origins = env.ARCHIPEN_MCP_ORIGINS ? env.ARCHIPEN_MCP_ORIGINS.split(',').map((s) => s.trim().replace(/\/+$/, '')) : [...DEFAULT_ORIGINS, new URL(appUrl).origin]

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  process.stderr.write(`archipen-mcp: an MCP server (stdio) that edits the diagram open in the Archipen editor.

  claude mcp add archipen -- npx -y @archipen/mcp

Environment: ARCHIPEN_MCP_PORT (default ${DEFAULT_BRIDGE_PORT}), ARCHIPEN_MCP_ORIGINS, ARCHIPEN_MCP_TOKEN, ARCHIPEN_APP_URL.
`)
  process.exit(0)
}

const bridge = new Bridge({ port: Number(env.ARCHIPEN_MCP_PORT) || DEFAULT_BRIDGE_PORT, origins, token: env.ARCHIPEN_MCP_TOKEN || undefined })
await bridge.start()
if (bridge.listenError) process.stderr.write(`archipen-mcp: ${bridge.listenError}\n`)
else process.stderr.write(`archipen-mcp: open ${pairingLink(appUrl, bridge.pairing)} to connect the editor\n`)

const server = createServer(bridge, { appUrl })
await server.connect(new StdioServerTransport())

const stop = () => void bridge.close().finally(() => process.exit(0))
process.stdin.on('close', stop)
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
