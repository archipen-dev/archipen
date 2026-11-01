import { expect, test } from 'vitest'
import { emptyDoc, parseDoc } from '../model/defaults'
import { useDocStore } from '../store/docStore'
import { copy, paste } from './clipboard'

const icon = { id: 'logo', name: 'Logo', viewBox: [0, 0, 24, 24] as [number, number, number, number], body: '<circle cx="12" cy="12" r="10"/>' }

test('pasting into another diagram brings the custom icons along', () => {
  const source = parseDoc({ format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0, icon: 'custom:logo' }] }], assets: { logo: icon } })
  useDocStore.getState().load(source)
  copy(['a'])

  useDocStore.getState().load(emptyDoc('Target'))
  const [id] = paste()
  const doc = useDocStore.getState().doc!
  expect(doc.pages[0].nodes.find((n) => n.id === id)?.icon).toBe('custom:logo')
  expect(doc.assets.logo).toEqual(icon)
})

test('an icon the target already has under that id is kept', () => {
  const source = parseDoc({ format: 'archipen', pages: [{ id: 'p', nodes: [{ id: 'a', x: 0, y: 0, icon: 'custom:logo' }] }], assets: { logo: icon } })
  useDocStore.getState().load(source)
  copy(['a'])

  const mine = { ...icon, name: 'Mine' }
  useDocStore.getState().load(parseDoc({ format: 'archipen', assets: { logo: mine } }))
  paste()
  expect(useDocStore.getState().doc!.assets.logo.name).toBe('Mine')
})

test('pasting into another diagram drops links to pages it does not have', () => {
  const source = parseDoc({
    format: 'archipen',
    pages: [
      { id: 'p', nodes: [{ id: 'a', x: 0, y: 0, link: { page: 'q' } }, { id: 'b', x: 4, y: 0, link: { page: 'p2' } }] },
      { id: 'p2' },
      { id: 'q' },
    ],
  })
  useDocStore.getState().load(source)
  copy(['a', 'b'])
  useDocStore.getState().load(parseDoc({ format: 'archipen', pages: [{ id: 'main' }, { id: 'p2' }] }))
  paste()
  const links = useDocStore.getState().doc!.pages[0].nodes.map((n) => n.link?.page)
  expect(links).toEqual([undefined, 'p2'])
})
