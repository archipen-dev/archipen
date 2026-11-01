import { describe, expect, it } from 'vitest'
import { timeAgo } from './time'

const now = Date.parse('2026-01-10T12:00:00Z')
const ago = (s: number) => new Date(now - s * 1000).toISOString()

describe('timeAgo', () => {
  it('reads minutes and hours in both styles', () => {
    expect(timeAgo(ago(10), { now })).toBe('just now')
    expect(timeAgo(ago(300), { now })).toBe('5 min ago')
    expect(timeAgo(ago(300), { now, compact: true })).toBe('5m ago')
    expect(timeAgo(ago(7200), { now })).toBe('2 h ago')
    expect(timeAgo(ago(7200), { now, compact: true })).toBe('2h ago')
  })
  it('uses days in compact style for the first week', () => {
    expect(timeAgo(ago(86400 * 3), { now, compact: true })).toBe('3d ago')
  })
})
