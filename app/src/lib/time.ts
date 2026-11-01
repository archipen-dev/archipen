const MINUTE = 60
const HOUR = 3600
const DAY = 86400

/**
 * "just now", "5 min ago", "3 h ago", then a date.
 * `compact` uses "5m ago" / "3h ago" / "2d ago" and switches to a date after a week.
 */
export function timeAgo(iso: string, { compact = false, now = Date.now() } = {}): string {
  const s = (now - new Date(iso).getTime()) / 1000
  if (s < MINUTE) return 'just now'
  if (s < HOUR) return compact ? `${Math.floor(s / MINUTE)}m ago` : `${Math.floor(s / MINUTE)} min ago`
  if (s < DAY) return compact ? `${Math.floor(s / HOUR)}h ago` : `${Math.floor(s / HOUR)} h ago`
  if (compact) return s < DAY * 7 ? `${Math.floor(s / DAY)}d ago` : new Date(iso).toLocaleDateString()
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

export const plural = (n: number, one: string, many = `${one}s`) => (n === 1 ? one : many)
