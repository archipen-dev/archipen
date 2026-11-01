import { describe, expect, it } from 'vitest'
import { stepThrough } from './selection'

describe('stepThrough', () => {
  const order = ['a', 'b', 'c']
  it('starts at an end when nothing is selected', () => {
    expect(stepThrough(order, undefined, 1)).toBe('a')
    expect(stepThrough(order, undefined, -1)).toBe('c')
  })
  it('steps forward and back', () => {
    expect(stepThrough(order, 'a', 1)).toBe('b')
    expect(stepThrough(order, 'c', -1)).toBe('b')
  })
  it('runs out past either end', () => {
    expect(stepThrough(order, 'c', 1)).toBeNull()
    expect(stepThrough(order, 'a', -1)).toBeNull()
    expect(stepThrough([], undefined, 1)).toBeNull()
  })
  it('starts over when the selection is not in the order', () => {
    expect(stepThrough(order, 'locked', 1)).toBe('a')
  })
})
