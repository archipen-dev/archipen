// Imported first in main.tsx, before the router reads the URL: takes `mcp=<port>.<token>` out of the hash
// (`#/?mcp=…` or `#/d/<id>?mcp=…`), keeps it for this tab, and removes it so the token doesn't stay in history.
import { parsePairing } from './bridgeProtocol'
import { savePairing } from './aiBridge'

const hash = location.hash
const q = hash.indexOf('?')
if (q >= 0) {
  const params = new URLSearchParams(hash.slice(q + 1))
  if (params.has('mcp')) {
    const pairing = parsePairing(params.get('mcp'))
    params.delete('mcp')
    const rest = params.toString()
    history.replaceState(history.state, '', `${location.pathname}${location.search}${hash.slice(0, q)}${rest ? `?${rest}` : ''}`)
    if (pairing) savePairing(pairing)
  }
}
