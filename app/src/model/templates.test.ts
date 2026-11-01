import { describe, expect, it } from 'vitest'
import { needsMoreVendorIcons } from '../icons/vendorLoader'
import { validateDoc } from './parse'
import { TEMPLATES, templateDoc } from './templates'

describe('templates', () => {
  it.each(TEMPLATES.map((t) => [t.id, t] as const))('%s loads without warnings', (_, t) => {
    const { doc, issues } = validateDoc(structuredClone(t.raw))
    expect(issues).toEqual([])
    expect(doc!.pages[0].nodes.length).toBeGreaterThan(3)
  })
  it('only uses vendor logos that ship with the app, so the home page stays light', () => {
    for (const t of TEMPLATES) expect(needsMoreVendorIcons(templateDoc(t).pages.flatMap((p) => p.nodes.map((n) => n.icon))), t.id).toBe(false)
  })
  it('gives every copy its own id', () => {
    expect(templateDoc(TEMPLATES[0]).id).not.toBe(templateDoc(TEMPLATES[0]).id)
  })
})
