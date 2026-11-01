// Built-in default values. Kept separate from defaults.ts so schema.ts can use them without an import cycle.
import type { LabelStyle, Settings, StyleDefaults } from './schema'

export const FILE_VERSION = 1

export const PALETTE = [
  '#5b7cfa', // indigo
  '#2fb5a0', // teal
  '#f2a93b', // amber
  '#e5604f', // coral
  '#9b6cf0', // violet
  '#4aa3df', // sky
  '#7dbb52', // green
  '#8a94a6', // slate
]

export const ZONE_PALETTE = ['#5b7cfa', '#2fb5a0', '#f2a93b', '#e5604f', '#9b6cf0', '#8a94a6']

export const NOTE_COLORS = ['#f7d774', '#f6b8a8', '#b9e2c8', '#bcd3f7', '#dcc8f5', '#e8e5dc']
export const EDGE_COLORS = ['#6b7488', '#1c2130', ...PALETTE.slice(0, 6)]

export const defaultStyles = (): StyleDefaults => ({
  node: { shape: 'block', color: PALETTE[0], outline: 1, iconPlacement: 'top', iconScale: 1, iconColor: '', w: 2, d: 2, h: 1, icon: 'lucide:server' },
  zone: { color: ZONE_PALETTE[0], dashed: false, border: 1.5, fill: 1 },
  edge: { arrows: 'end', style: 'solid', color: '#6b7488', width: 2, arrowSize: 1, flow: { enabled: true, direction: 'forward', speed: 1 } },
  text: { color: '' },
  note: { color: NOTE_COLORS[0], w: 3, d: 2 },
})

export const defaultLabelStyles = (): Record<'node' | 'zone' | 'edge' | 'text', LabelStyle> => ({
  node: { side: 'bottom', align: 'middle', orientation: 'screen', inside: false, offset: 8, fontSize: 13, showDescription: false, hidden: false },
  zone: { side: 'bottom', align: 'start', orientation: 'ground-x', inside: true, offset: 8, fontSize: 14, showDescription: false, hidden: false },
  edge: { side: 'top', align: 'middle', orientation: 'screen', inside: false, offset: 6, fontSize: 11, showDescription: false, hidden: false },
  text: { side: 'center', align: 'middle', orientation: 'ground-x', inside: true, offset: 0, fontSize: 16, showDescription: true, hidden: false },
})

export const defaultSettings = (): Settings => ({
  styles: defaultStyles(),
  projection: 'iso',
  crossing: 'hop',
  grid: true,
  labelDefaults: defaultLabelStyles(),
})
