import { expect, test, type Page } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any; update: (fn: (d: any) => void) => void; undo: () => void } }; useUi: { getState: () => any } } }
const nodes = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc.pages[0].nodes as { id: string; x: number; y: number; w: number; d: number }[])

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await page.evaluate(() => {
    const { useDocStore, useUi } = (window as unknown as W).__archipen
    useDocStore.getState().update((d) => {
      const n = (id: string, x: number, y: number, w = 2) => ({ id, name: id, description: '', x, y, w, d: 2, h: 1 })
      d.pages[0].nodes.push(n('a', 0, 0), n('b', 4, 3, 3), n('c', 13, 6))
    })
    useUi.getState().select(['a', 'b', 'c'])
  })
})

test('align and spread from the selection panel, undo restores', async ({ page }) => {
  const alongX = page.getByRole('group', { name: 'Along X' })
  const alongY = page.getByRole('group', { name: 'Along Y' })

  await alongY.getByRole('button', { name: 'Start' }).click()
  expect((await nodes(page)).map((n) => n.y)).toEqual([0, 0, 0])

  await alongX.getByRole('button', { name: 'Spread' }).click()
  // sizes 2+3+2 over span 15 → gaps of 4
  expect((await nodes(page)).map((n) => n.x)).toEqual([0, 6, 13])

  await page.getByRole('button', { name: 'Match first node' }).click()
  expect((await nodes(page)).map((n) => n.w)).toEqual([2, 2, 2])

  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  expect((await nodes(page)).map((n) => [n.x, n.y])).toEqual([[0, 0], [4, 3], [13, 6]])
})
