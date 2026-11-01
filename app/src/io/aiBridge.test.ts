import { describe, expect, it } from 'vitest'
import { allowsLoopbackFromHttps, classifyFailure } from './aiBridge'
import { CLOSE, pairingLink, parsePairing } from './bridgeProtocol'

const CHROME = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'
const FIREFOX = 'Mozilla/5.0 (X11; Linux x86_64; rv:144.0) Gecko/20100101 Firefox/144.0'
const SAFARI = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/19.0 Safari/605.1.15'
const IOS_CHROME = 'Mozilla/5.0 (iPhone; CPU iPhone OS 19_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0 Mobile/15E148 Safari/604.1'

const closed = (code: number, opts: { opened?: boolean; secure?: boolean; userAgent?: string } = {}) =>
  classifyFailure({ kind: 'close', code, opened: opts.opened ?? false, secure: opts.secure ?? false, userAgent: opts.userAgent ?? CHROME })

describe('classifyFailure', () => {
  it('no WebSocket or a constructor error: not supported', () => {
    expect(classifyFailure({ kind: 'missing' })).toBe('unsupported')
    expect(classifyFailure({ kind: 'throw', error: new DOMException('blocked', 'SecurityError') })).toBe('unsupported')
  })
  it('an early failure on https in Safari or iOS: not supported', () => {
    expect(closed(1006, { secure: true, userAgent: SAFARI })).toBe('unsupported')
    expect(closed(1006, { secure: true, userAgent: IOS_CHROME })).toBe('unsupported')
  })
  it('an early failure in Chrome or Firefox, or on http: not reachable', () => {
    expect(closed(1006, { secure: true, userAgent: CHROME })).toBe('unreachable')
    expect(closed(1006, { secure: true, userAgent: FIREFOX })).toBe('unreachable')
    expect(closed(1006, { secure: false, userAgent: SAFARI })).toBe('unreachable')
  })
  it('a connection that worked and then dropped: not reachable', () => {
    expect(closed(1006, { opened: true, secure: true, userAgent: SAFARI })).toBe('unreachable')
  })
  it('server close codes', () => {
    expect(closed(CLOSE.badToken)).toBe('rejected')
    expect(closed(CLOSE.badOrigin)).toBe('rejected')
    expect(closed(CLOSE.replaced, { opened: true })).toBe('replaced')
  })
  it('knows which browsers allow loopback from https', () => {
    expect([CHROME, FIREFOX, SAFARI, IOS_CHROME].map(allowsLoopbackFromHttps)).toEqual([true, true, false, false])
  })
})

describe('pairing', () => {
  it('parses and builds links', () => {
    expect(parsePairing('7331.abcdefgh_-12')).toEqual({ port: 7331, token: 'abcdefgh_-12' })
    expect(parsePairing('99999.abcdefgh')).toBeNull()
    expect(parsePairing('7331.short')).toBeNull()
    expect(parsePairing(null)).toBeNull()
    expect(pairingLink('https://x.dev/app/#/d/1', { port: 1, token: 'abcdefgh' })).toBe('https://x.dev/app/#/?mcp=1.abcdefgh')
  })
})

describe('pairWithCode', () => {
  it('refuses text that is not a code or link', async () => {
    const { pairWithCode } = await import('./aiBridge')
    expect(pairWithCode('hello')).toBe(false)
    expect(pairWithCode('https://x.dev/#/?mcp=1.short')).toBe(false)
  })
})
