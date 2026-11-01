import { describe, expect, it } from 'vitest'
import { modifier, shortcut, shortcutLetter } from './keys'

describe('shortcut labels', () => {
  it('uses symbols in Apple order on a Mac', () => {
    expect(shortcut('Mod+Shift+S', true)).toBe('⇧⌘S')
    expect(shortcut('Mod++', true)).toBe('⌘+')
    expect(shortcut('Shift+1', true)).toBe('⇧1')
    expect(modifier('Alt', true)).toBe('⌥')
  })
  it('uses Ctrl/Shift words elsewhere', () => {
    expect(shortcut('Mod+Shift+S', false)).toBe('Ctrl+Shift+S')
    expect(shortcut('Mod++', false)).toBe('Ctrl++')
    expect(shortcut('Mod+Enter', false)).toBe('Ctrl+Enter')
    expect(modifier('Mod', false)).toBe('Ctrl')
  })
})

describe('shortcutLetter', () => {
  it('keeps the typed letter on Latin layouts (AZERTY "a" sits on KeyQ)', () => {
    expect(shortcutLetter({ key: 'a', code: 'KeyQ' })).toBe('a')
    expect(shortcutLetter({ key: 'Z', code: 'KeyZ' })).toBe('z')
  })
  it('falls back to the physical key on non-Latin layouts', () => {
    expect(shortcutLetter({ key: 'ы', code: 'KeyS' })).toBe('s')
    expect(shortcutLetter({ key: '=', code: 'Equal' })).toBe('=')
  })
})
