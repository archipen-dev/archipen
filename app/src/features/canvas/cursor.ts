import type { Mode, Tool } from '../../store/uiStore'

export function canvasCursor(s: { panning: boolean; spaceDown: boolean; tool: Tool; mode: Mode; hovering: boolean }): string {
  if (s.panning) return 'grabbing'
  if (s.spaceDown || s.tool === 'hand') return 'grab'
  if (s.hovering && (s.mode === 'view' || s.tool === 'select')) return 'pointer'
  if (s.mode === 'view') return 'grab'
  return s.tool === 'select' ? 'default' : 'crosshair'
}
