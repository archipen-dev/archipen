// Checked by `npm run typecheck`: the hand-written index.d.ts must match what src/index.ts exports.
import { expect, test } from 'vitest'
import type * as Public from '../index'
import * as impl from '../src/index'

const api: Pick<typeof Public, 'renderSvg' | 'renderPng' | 'renderPdf' | 'render' | 'validateDiagram' | 'formatIssueLine' | 'FORMATS' | 'CONTENT_TYPES'> = impl
const opts: Public.RenderOptions = {} satisfies impl.RenderOptions
const back: impl.RenderOptions = opts

test('public API exists', () => {
  for (const k of Object.keys(api) as (keyof typeof api)[]) expect(impl[k]).toBeDefined()
  expect(impl.DiagramError).toBeTypeOf('function')
  expect(back).toEqual({})
})
