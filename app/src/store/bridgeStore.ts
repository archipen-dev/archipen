import { create } from 'zustand'

/**
 * The link to a local AI tool (the Archipen MCP server, see io/aiBridge.ts).
 * - off: not paired
 * - connecting / connected
 * - unreachable: the server isn't answering; retrying
 * - unsupported: this browser can't connect from this page (when only guessed from the browser, still retrying)
 * - rejected: the server refused the pairing (old link, or this site isn't allowed); not retrying
 * - replaced: another tab took over; not retrying
 */
export type BridgeStatus = 'off' | 'connecting' | 'connected' | 'unreachable' | 'unsupported' | 'rejected' | 'replaced'

export const useBridge = create<{ status: BridgeStatus; port: number | null; message: string }>(() => ({ status: 'off', port: null, message: '' }))
