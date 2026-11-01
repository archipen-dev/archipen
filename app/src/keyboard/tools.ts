import type { Tool } from '../store/uiStore'

/** Canvas tools in toolbar order, with their single-letter keys. */
export const TOOLS: { tool: Tool; label: string; key: string }[] = [
  { tool: 'select', label: 'Select', key: 'V' },
  { tool: 'hand', label: 'Hand', key: 'H' },
  { tool: 'node', label: 'Node', key: 'R' },
  { tool: 'zone', label: 'Zone', key: 'F' },
  { tool: 'connect', label: 'Connect', key: 'C' },
  { tool: 'text', label: 'Text', key: 'T' },
  { tool: 'note', label: 'Sticky note', key: 'N' },
]

/** Tools that only look around, so they also work in view mode. */
export const isViewTool = (t: Tool) => t === 'select' || t === 'hand'
