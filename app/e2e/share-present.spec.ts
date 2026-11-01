import { expect, test, type Page } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any } }; useUi: { getState: () => any } } }
const docState = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)

async function openTemplate(page: Page) {
  await page.goto('/')
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Web app/ }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
}

test('in iso, arrow keys move items along the screen', async ({ page }) => {
  await openTemplate(page)
  const n = (await docState(page)).pages[0].nodes[1]
  await page.evaluate((id) => (window as unknown as W).__archipen.useUi.getState().select([id]), n.id)
  await page.keyboard.press('ArrowRight')
  const m = (await docState(page)).pages[0].nodes[1]
  // screen y ∝ x + y must not change; screen x ∝ x − y grows
  expect(m.x + m.y).toBe(n.x + n.y)
  expect(m.x - m.y).toBeGreaterThan(n.x - n.y)
})

test('PNG export downloads a PNG', async ({ page }) => {
  await openTemplate(page)
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem').filter({ hasText: 'PNG' }).filter({ hasText: '2×' }).click()])
  expect(dl.suggestedFilename()).toMatch(/@2x\.png$/)
  const stream = await dl.createReadStream()
  const head: Buffer = await new Promise((resolve) => stream.once('data', (c) => resolve(c as Buffer)))
  expect(head.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
})

test('a share link opens read-only in a fresh browser', async ({ page, browser, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openTemplate(page)
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-link-2') }).click()
  await page.getByRole('menuitem', { name: /Copy link/ }).click()
  await expect(page.getByText(/link copied/i)).toBeVisible()
  const url: string = await page.evaluate(() => navigator.clipboard.readText())
  expect(url).toMatch(/\/#\/share#1\./)

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto(url)
  await expect(other.locator('.ap-labels text', { hasText: 'Postgres' })).toHaveCount(1)
  await expect(other.getByText('Shared diagram · read-only', { exact: false })).toBeVisible()
  await expect(other.getByRole('button', { name: 'Save a copy' })).toBeVisible()
  await expect(other.getByRole('group', { name: 'Edit' })).toHaveCount(0)
  // dragging must not move anything; a click shows the details
  const before = await other.locator('.ap-nodes').innerHTML()
  const box = (await other.locator('.ap-nodes [data-kind="node"]').first().boundingBox())!
  await other.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
  await other.mouse.down()
  await other.mouse.move(box.x + 200, box.y + 100, { steps: 5 })
  await other.mouse.up()
  expect(await other.locator('.ap-nodes').innerHTML()).toBe(before)
  await other.mouse.click(box.x + 200, box.y + 100)
  await expect(other.getByRole('button', { name: 'Close panel' })).toBeVisible()
  // nothing was stored in the fresh browser
  await other.goto('/')
  await expect(other.getByText('Web shop')).toHaveCount(0)
  await fresh.close()
})

test('own diagrams have no view mode', async ({ page }) => {
  await openTemplate(page)
  await expect(page.getByRole('button', { name: 'View', exact: true })).toHaveCount(0)
  // an old ?mode=view link opens for editing
  await page.goto(page.url().replace(/mode=edit/, 'mode=view'))
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await expect(page.getByText('read-only', { exact: false })).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__archipen.useUi.getState().mode)).toBe('edit')
})

test('present mode hides the chrome; Esc brings it back', async ({ page }) => {
  await openTemplate(page)
  await expect(page.locator('header.pointer-events-none')).toBeVisible()
  await page.keyboard.press('p')
  await expect(page.locator('header.pointer-events-none')).toHaveCount(0)
  await expect(page).toHaveURL(/mode=present/)
  // click an item: everything else dims
  const label = page.locator('.ap-labels [data-id] text', { hasText: 'API' }).first()
  await label.click()
  await expect(page.locator('.ap-scene.ap-focusing')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(page.locator('.ap-scene.ap-focusing')).toHaveCount(0)
  await page.keyboard.press('Escape')
  await expect(page.locator('header.pointer-events-none')).toBeVisible()
  await expect(page).toHaveURL(/mode=edit/)
})
