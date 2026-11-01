import { readFileSync } from 'node:fs'
import { describe, expect, test } from 'vitest'
import { SECURITY_HEADERS } from '../csp.ts'

// The Docker image (deploy/Caddyfile) and the nginx example in the hosting guide copy the headers by hand.
const read = (p: string) => readFileSync(new URL(`../../${p}`, import.meta.url), 'utf8')
const value = (v: string) => (/\s/.test(v) ? `"${v}"` : v)

describe.each(Object.entries(SECURITY_HEADERS))('%s', (name, v) => {
  test('deploy/Caddyfile sends it', () => {
    expect(read('deploy/Caddyfile')).toContain(`${name} ${value(v)}`)
  })
  test('the nginx example in docs/hosting.md sends it', () => {
    expect(read('docs/hosting.md')).toContain(`add_header ${name} ${value(v)} always;`)
  })
})
