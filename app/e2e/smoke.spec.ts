import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` })
}

async function canvasPoint(page: Page, fx: number, fy: number) {
  const box = (await page.locator('[data-canvas]').boundingBox())!
  return { x: box.x + box.width * fx, y: box.y + box.height * fy }
}

test('create, connect, edit, persist and export', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))

  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()

  // place two nodes with the R tool
  const a = await canvasPoint(page, 0.3, 0.45)
  const b = await canvasPoint(page, 0.55, 0.45)
  await page.keyboard.press('r')
  await page.mouse.click(a.x, a.y)
  await page.keyboard.press('r')
  await page.mouse.click(b.x, b.y)
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(2)

  // draw a zone around them
  const z0 = await canvasPoint(page, 0.18, 0.25)
  const z1 = await canvasPoint(page, 0.66, 0.68)
  await page.keyboard.press('f')
  await page.mouse.move(z0.x, z0.y)
  await page.mouse.down()
  await page.mouse.move(z1.x, z1.y, { steps: 6 })
  await page.mouse.up()
  await expect(page.locator('.ap-zones polygon')).not.toHaveCount(0)

  // connect: C tool, drag from node A to node B
  const nodes = page.locator('.ap-nodes [data-kind="node"]')
  const na = (await nodes.nth(0).boundingBox())!
  const nb = (await nodes.nth(1).boundingBox())!
  await page.keyboard.press('c')
  await page.mouse.move(na.x + na.width / 2, na.y + na.height / 2)
  await page.mouse.down()
  await page.mouse.move(nb.x + nb.width / 2, nb.y + nb.height / 2, { steps: 8 })
  await page.mouse.up()
  await expect(page.locator('.ap-edges [data-kind="edge"]')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await shot(page, 'e2e-1-created')

  // rename the first node through the panel
  await page.keyboard.press('Escape')
  await page.mouse.click(na.x + na.width / 2, na.y + na.height / 2)
  const nameInput = page.getByPlaceholder('Name', { exact: true })
  await nameInput.fill('Gateway')
  await expect(page.locator('.ap-labels text', { hasText: 'Gateway' })).toHaveCount(1)
  await shot(page, 'e2e-2-properties')

  // undo / redo the rename
  await page.locator('[data-canvas]').click({ position: { x: 5, y: 300 } })
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+Shift+z')
  await expect(page.locator('.ap-labels text', { hasText: 'Gateway' })).toHaveCount(1)

  // 2D and back
  await page.keyboard.press('Shift+P')
  await expect(page.getByRole('button', { name: '2D', exact: true }).first()).toBeVisible()
  await shot(page, 'e2e-3-2d')
  await page.keyboard.press('Shift+P')

  // export SVG: plain vector, no foreignObject
  const download = page.waitForEvent('download')
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
  await page.getByRole('menuitem', { name: /SVG.*font embedded/ }).click()
  const file = await download
  const svg = await (await file.createReadStream()).toArray().then((c) => Buffer.concat(c).toString())
  expect(svg).toContain('<polygon')
  expect(svg).toContain('<text')
  expect(svg).toContain('Gateway')
  expect(svg).not.toContain('foreignObject')

  // PDF export produces a file
  const pdfDl = page.waitForEvent('download')
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
  await page.getByRole('menuitem', { name: 'PDF' }).click()
  const pdf = await pdfDl
  const pdfBytes = Buffer.concat(await (await pdf.createReadStream()).toArray())
  expect(pdfBytes.subarray(0, 5).toString()).toBe('%PDF-')
  expect(pdfBytes.length).toBeGreaterThan(1000)

  // autosave survives a reload
  await page.waitForTimeout(900)
  await page.reload()
  await expect(page.locator('.ap-labels text', { hasText: 'Gateway' })).toHaveCount(1)
  await page.goto('/')
  await expect(page.getByText('Untitled diagram')).toBeVisible()
  await shot(page, 'e2e-5-home')

  expect(errors).toEqual([])
})
