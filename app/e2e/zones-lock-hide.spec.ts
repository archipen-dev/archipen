import { expect, test, type Page } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any; update: (fn: (d: any) => void) => void } }; useUi: { getState: () => any } } }
const docState = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)
const select = (page: Page, ids: string[]) => page.evaluate((ids) => (window as unknown as W).__archipen.useUi.getState().select(ids), ids)

async function center(page: Page, selector: string) {
  const b = (await page.locator(selector).first().boundingBox())!
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 }
}

test.beforeEach(async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await page.evaluate(() => {
    const { useDocStore } = (window as unknown as W).__archipen
    useDocStore.getState().update((d) => {
      d.pages[0].zones.push({ id: 'z1', name: 'Backend', description: '', x: 6, y: -1, w: 6, d: 5 })
      d.pages[0].nodes.push({ id: 'n1', name: 'Client', description: '', x: 0, y: 0, w: 2, d: 2, h: 1 })
    })
  })
  await page.keyboard.press('Shift+1')
})

test('the connect tool joins a node to a zone', async ({ page }) => {
  const from = await center(page, '.ap-nodes [data-id="n1"]')
  const to = await center(page, '.ap-zones [data-id="z1"]')
  await page.keyboard.press('c')
  await page.mouse.move(from.x, from.y)
  await page.mouse.down()
  await page.mouse.move(to.x, to.y, { steps: 8 })
  await page.mouse.up()
  const doc = await docState(page)
  expect(doc.pages[0].edges).toHaveLength(1)
  expect(doc.pages[0].edges[0].from).toEqual({ nodeId: 'n1' })
  expect(doc.pages[0].edges[0].to).toEqual({ zoneId: 'z1' })
  await expect(page.locator('.ap-edges [data-kind="edge"]')).toHaveCount(1)

  // deleting the zone takes the wire with it
  await select(page, ['z1'])
  await page.keyboard.press('Delete')
  expect((await docState(page)).pages[0].edges).toHaveLength(0)
})

test('a locked zone can be selected but stays put when dragged; unlocking from the top-bar list frees it', async ({ page }) => {
  await select(page, ['z1'])
  await page.getByRole('button', { name: 'Lock', exact: true }).click()
  await page.keyboard.press('Escape')

  const label = await center(page, '[data-kind="zone"][data-label] text')
  await page.mouse.move(label.x, label.y)
  await page.mouse.down()
  await page.mouse.move(label.x + 160, label.y + 10, { steps: 8 })
  await page.mouse.up()
  expect((await docState(page)).pages[0].zones[0].x).toBe(6)
  expect(await page.evaluate(() => (window as unknown as W).__archipen.useUi.getState().selection)).toEqual(['z1'])
  await expect(page.locator('[data-handle="resize"]')).toHaveCount(0)

  await page.getByRole('button', { name: /Locked & hidden/ }).click()
  const list = page.getByRole('list', { name: 'Locked and hidden items' })
  await list.getByRole('button', { name: 'Unlock Backend' }).click()
  expect((await docState(page)).pages[0].zones[0].locked).toBeUndefined()
  await expect(list).toHaveCount(0)
})

test('hide a node with the shortcut; it is not drawn until shown again', async ({ page }) => {
  await select(page, ['n1'])
  await page.keyboard.press('Control+Shift+h')
  expect((await docState(page)).pages[0].nodes[0].hidden).toBe(true)
  await expect(page.locator('.ap-nodes [data-id="n1"]')).toHaveCount(0)

  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /Locked & hidden/ }).click()
  await page.getByRole('list', { name: 'Locked and hidden items' }).getByRole('button', { name: 'Show Client' }).click()
  await expect(page.locator('.ap-nodes [data-id="n1"]')).toHaveCount(1)
})
