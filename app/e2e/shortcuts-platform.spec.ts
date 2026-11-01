import { expect, test, type Page } from '@playwright/test'

// Playwright runs Chromium on Linux here, so this checks the non-Mac behaviour.
type W = { __archipen: { useDocStore: { getState: () => { doc: any; update: (fn: (d: any) => void) => void } } } }
const nodeCount = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc.pages[0].nodes.length)
type Key = { key: string; code: string; ctrlKey?: boolean; altKey?: boolean }
const press = (page: Page, init: Key) => page.evaluate((init) => window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })), init)

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await page.evaluate(() => {
    ;(window as unknown as W).__archipen.useDocStore.getState().update((d) => {
      d.pages[0].nodes.push({ id: 'n1', name: 'A', description: '', x: 0, y: 0, w: 2, d: 2, h: 1 })
    })
  })
})

test('shortcut labels use Ctrl and Shift, not Mac symbols', async ({ page }) => {
  await page.keyboard.press('?')
  const dialog = page.getByRole('dialog', { name: 'Keyboard shortcuts' })
  await expect(dialog).toContainText('Ctrl+Shift+L')
  await expect(dialog).toContainText('Ctrl+Shift+S')
  await expect(dialog).not.toContainText('⌘')
  await expect(dialog).not.toContainText('⇧')
})

test('Ctrl shortcuts work on a non-Latin layout, and AltGr does not trigger them', async ({ page }) => {
  expect(await nodeCount(page)).toBe(1)
  // AltGr+Z (reported as Ctrl+Alt) types a character on some layouts; it must not undo.
  await press(page, { key: 'z', code: 'KeyZ', ctrlKey: true, altKey: true })
  expect(await nodeCount(page)).toBe(1)
  // Ctrl+Z on a Russian layout reports key "я".
  await press(page, { key: 'я', code: 'KeyZ', ctrlKey: true })
  expect(await nodeCount(page)).toBe(0)
  await page.keyboard.press('Control+Shift+z')
  expect(await nodeCount(page)).toBe(1)
})
