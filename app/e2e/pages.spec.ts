import AxeBuilder from '@axe-core/playwright'
import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any } }; useUi: { getState: () => any } } }
const doc = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)
const nodeLabels = (page: Page) => page.locator('.ap-nodes [data-kind="node"]')
const crumbs = (page: Page) => page.getByRole('navigation', { name: 'Pages' })
async function goToPage(page: Page, name: string) {
  await page.getByRole('button', { name: /^Pages/ }).click()
  await page.getByRole('menuitem', { name, exact: true }).click()
}

const file = new URL('../../examples/drill-down.archipen.json', import.meta.url)

async function openDrillDown(page: Page) {
  const text = readFileSync(file, 'utf8')
  await page.goto('/')
  const dt = await page.evaluateHandle((t) => {
    const d = new DataTransfer()
    d.items.add(new File([t], 'drill-down.archipen.json', { type: 'application/json' }))
    return d
  }, text)
  await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await expect(nodeLabels(page)).toHaveCount(5)
}

/** Copy the open diagram's share link and open it in the same tab. */
async function openAsShare(page: Page) {
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-link-2') }).click()
  await page.getByRole('menuitem', { name: /Copy link/ }).click()
  const url: string = await page.evaluate(() => navigator.clipboard.readText())
  await page.goto(url)
  await expect(page.getByText('Shared diagram · read-only', { exact: false })).toBeVisible()
  await expect(nodeLabels(page)).toHaveCount(5)
}

/** Click the middle of a drawn node or zone. */
async function clickItem(page: Page, id: string) {
  const item = page.locator(`[data-id="${id}"]`).first()
  await expect(item).toBeVisible()
  const b = (await item.boundingBox())!
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2)
}

test('shared diagram: clicking a linked node drills in, the breadcrumb and Alt+Left lead back', async ({ page }) => {
  await openDrillDown(page)
  await openAsShare(page)

  await clickItem(page, 'checkout')
  await expect(crumbs(page).locator('[aria-current="page"]')).toHaveText('Checkout')
  await expect(nodeLabels(page)).toHaveCount(4)
  await expect(page.locator('[data-id="payments"]').first()).toBeVisible()
  await expect(page).toHaveURL(/page=checkout-detail/)
  await expect(page.locator('[data-canvas]')).toHaveAccessibleName('Web shop, drill-down, page Checkout')

  // A reload opens the same page.
  await page.reload()
  await expect(page.locator('[data-id="payments"]').first()).toBeVisible()

  await goToPage(page, 'Overview')
  await expect(nodeLabels(page)).toHaveCount(5)
  await expect(page).not.toHaveURL(/page=/)

  // A linked zone drills in too; Alt+Left goes back.
  await clickItem(page, 'data')
  await expect(page.locator('[data-id="pg-primary"]').first()).toBeVisible()
  await page.locator('[data-canvas]').focus()
  await page.keyboard.press('Alt+ArrowLeft')
  await expect(nodeLabels(page)).toHaveCount(5)
})

test('edit mode: Ctrl-click opens a linked item, a plain click or Ctrl-drag does not', async ({ page }) => {
  await openDrillDown(page)
  const current = crumbs(page).locator('[aria-current="page"]')

  // A plain click only selects.
  await clickItem(page, 'checkout')
  await expect(page.getByRole('button', { name: 'Open page' })).toBeVisible()
  await expect(nodeLabels(page)).toHaveCount(5)

  // Ctrl-drag moves (without snapping) and stays on the page.
  const before = (await doc(page)).pages[0].nodes.find((n: { id: string }) => n.id === 'checkout')
  const b = (await page.locator('[data-id="checkout"]').first().boundingBox())!
  await page.keyboard.down('Control')
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2)
  await page.mouse.down()
  await page.mouse.move(b.x + b.width / 2 + 30, b.y + b.height / 2 + 10, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Control')
  await expect(nodeLabels(page)).toHaveCount(5)
  const after = (await doc(page)).pages[0].nodes.find((n: { id: string }) => n.id === 'checkout')
  expect([after.x, after.y]).not.toEqual([before.x, before.y])

  // Ctrl-click on a node, then on a zone's body, opens the linked page.
  await page.keyboard.down('Control')
  await clickItem(page, 'checkout')
  await page.keyboard.up('Control')
  await expect(current).toHaveValue('Checkout')
  await goToPage(page, 'Overview')
  await page.keyboard.down('Control')
  await clickItem(page, 'data')
  await page.keyboard.up('Control')
  await expect(page.locator('[data-id="pg-primary"]').first()).toBeVisible()
})

test('linked items say where they lead; the page has no axe violations', async ({ page }) => {
  await openDrillDown(page)
  await expect(page.locator('[data-id="checkout"]').first()).toHaveAttribute('aria-label', /Details on page Checkout\./)
  await page.getByRole('button', { name: /^Pages/ }).click()
  await page.getByRole('menuitem', { name: 'Data', exact: true }).click()
  await expect(page.locator('[data-id="pg-primary"]').first()).toBeVisible()
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity))
  const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze()
  expect(violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(' ')).join(', ')}`)).toEqual([])
})

test('edit mode: add a linked page from the panel, edit it, undo comes back to it', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await openDrillDown(page)
  await clickItem(page, 'web')
  await page.getByRole('button', { name: 'New linked page' }).click()
  expect((await doc(page)).pages.map((p: { name: string }) => p.name)).toEqual(['Overview', 'Checkout', 'Data', 'Web app'])
  await page.getByRole('button', { name: 'Open page' }).click()
  await expect(crumbs(page).getByRole('textbox', { name: 'Page name' })).toHaveValue('Web app')
  await expect(nodeLabels(page)).toHaveCount(0)

  // Add a node on the new page, go back, undo: the editor shows the page that changed.
  await page.keyboard.press('r')
  await page.mouse.click(700, 450)
  await expect(nodeLabels(page)).toHaveCount(1)
  await goToPage(page, 'Overview')
  await expect(nodeLabels(page)).toHaveCount(5)
  await page.keyboard.press('Control+z')
  await expect(crumbs(page).getByRole('textbox', { name: 'Page name' })).toHaveValue('Web app')
  await expect(nodeLabels(page)).toHaveCount(0)

  // Deleting the page removes the link to it.
  await page.getByRole('button', { name: /^Pages/ }).click()
  await page.getByRole('menuitem', { name: 'Delete Web app' }).click()
  await expect(nodeLabels(page)).toHaveCount(5)
  const d = await doc(page)
  expect(d.pages).toHaveLength(3)
  expect(d.pages[0].nodes.find((n: { id: string }) => n.id === 'web').link).toBeUndefined()
})

test('a share link keeps every page', async ({ page, context, browser }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await openDrillDown(page)
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-link-2') }).click()
  await page.getByRole('menuitem', { name: /Copy link/ }).click()
  await expect(page.getByText(/link copied/i)).toBeVisible()
  const url: string = await page.evaluate(() => navigator.clipboard.readText())

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto(url)
  await expect(nodeLabels(other)).toHaveCount(5)
  await clickItem(other, 'checkout')
  await expect(other.locator('[data-id="payments"]').first()).toBeVisible()
  // The link data stays in the URL, so presenting from here still works.
  await other.keyboard.press('p')
  await expect(other.locator('[data-id="payments"]').first()).toBeVisible()
  await fresh.close()
})

test('the SVG export holds every page, and clicking a linked item shows its page', async ({ page }, testInfo) => {
  await openDrillDown(page)
  await page.getByRole('button', { name: 'Export' }).click()
  await expect(page.getByRole('menuitemradio', { name: 'All 3 pages' })).toBeChecked()
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^SVG\s*font embedded, clickable/ }).click()])
  expect(download.suggestedFilename()).toBe('Web shop, drill-down.svg')
  // Saved with its .svg name, so the browser opens it as an SVG document.
  const path = testInfo.outputPath(download.suggestedFilename())
  await download.saveAs(path)

  await page.goto(`file://${path}`)
  const shown = (id: string) => page.evaluate((id) => getComputedStyle(document.getElementById(id)!).display !== 'none', id)
  expect(await shown('ap-page-overview')).toBe(true)
  expect(await shown('ap-page-checkout-detail')).toBe(false)

  await page.locator('a[href="#ap-page-checkout-detail"]').first().click()
  await expect.poll(() => shown('ap-page-checkout-detail')).toBe(true)
  expect(await shown('ap-page-overview')).toBe(false)

  // The back link, and the browser's Back button.
  await page.locator('#ap-page-checkout-detail a[href="#ap-page-overview"]').click()
  await expect.poll(() => shown('ap-page-overview')).toBe(true)
  await page.goBack()
  await expect.poll(() => shown('ap-page-checkout-detail')).toBe(true)
})

test('the export menu can export just the page on screen', async ({ page }) => {
  await openDrillDown(page)
  await page.getByRole('button', { name: /^Pages/ }).click()
  await page.getByRole('menuitem', { name: 'Data', exact: true }).click()
  await page.getByRole('button', { name: 'Export' }).click()
  await page.getByRole('menuitemradio', { name: 'This page' }).click()
  // The menu stays open after picking the scope.
  const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /^SVG\s*font embedded$/ }).click()])
  expect(download.suggestedFilename()).toBe('Web shop, drill-down - Data.svg')
  const svg = readFileSync((await download.path())!, 'utf8')
  expect(svg).not.toContain('ap-page')
  expect(svg).toContain('Postgres primary')
})
