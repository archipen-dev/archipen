export interface CanvasTheme {
  name: 'light' | 'dark'
  bg: string
  grid: string
  gridAxis: string
  text: string
  muted: string
  accent: string
  /** Strength of zone tint over the background. */
  zoneTint: number
}

export const LIGHT: CanvasTheme = {
  name: 'light',
  bg: '#f5f4f0',
  grid: '#e4e2db',
  gridAxis: '#d6d3ca',
  text: '#1c2130',
  muted: '#646b7c',
  accent: '#f0532a',
  zoneTint: 0.1,
}

export const DARK: CanvasTheme = {
  name: 'dark',
  bg: '#121419',
  grid: '#1e2129',
  gridAxis: '#272b35',
  text: '#e8eaf0',
  muted: '#9299aa',
  accent: '#ff6a3d',
  zoneTint: 0.16,
}

export const FONT_STACK = "'Instrument Sans Variable', 'Instrument Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif"

function parse(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h.padEnd(6, '0').slice(0, 6)
  const n = parseInt(full, 16)
  return Number.isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** Blend `fg` over `bg` by `t` (0 = bg, 1 = fg). */
export function mix(bg: string, fg: string, t: number): string {
  const a = parse(bg),
    b = parse(fg)
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * t))
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('')
}

export function luminance(hex: string): number {
  const [r, g, b] = parse(hex).map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** Readable ink colour on top of `hex`. */
export const inkOn = (hex: string) => (luminance(hex) > 0.45 ? '#1c2130' : '#ffffff')

/** WCAG contrast ratio between two colours (1 = identical, 21 = black on white). */
export function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}
