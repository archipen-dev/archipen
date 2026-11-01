import { describe, expect, it } from 'vitest'
import { BINDINGS, matches, shortcutHelp, toKeyPress } from './keymap'

const press = (key: string, mods: Partial<{ metaKey: boolean; ctrlKey: boolean; altKey: boolean; shiftKey: boolean }> = {}, code = '') =>
  toKeyPress({ key, code, metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...mods })

const first = (p: ReturnType<typeof press>) => BINDINGS.find((b) => matches(b, p))?.id

describe('keymap', () => {
  it('treats Ctrl+Alt (AltGr) as no modifier', () => {
    expect(press('@', { ctrlKey: true, altKey: true }).mod).toBe(false)
  })

  it('needs Mod to match exactly', () => {
    expect(first(press('z', { ctrlKey: true }))).toBe('undo')
    expect(first(press('z'))).toBeUndefined()
    expect(first(press('r'))).toBe('tool-node')
    expect(first(press('r', { ctrlKey: true }))).toBeUndefined()
  })

  it('tells save, lock and hide apart from tool keys', () => {
    expect(first(press('s', { metaKey: true, shiftKey: true }))).toBe('save')
    expect(first(press('h', { ctrlKey: true, shiftKey: true }))).toBe('hide')
    expect(first(press('h'))).toBe('tool-hand')
    expect(first(press('P', { shiftKey: true }, 'KeyP'))).toBe('projection')
    expect(first(press('p'))).toBe('present')
  })

  it('has a binding for every row of the shortcuts dialog', () => {
    const groups = shortcutHelp()
    expect(groups.map((g) => g.group)).toEqual(['Tools', 'Navigate', 'Edit', 'Diagram'])
    expect(groups.flatMap((g) => g.rows).every((r) => r.label && r.keys.length)).toBe(true)
  })
})
