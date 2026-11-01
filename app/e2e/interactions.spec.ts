import { expect, test, type Page } from '@playwright/test'

const SHOTS = process.env.SHOTS_DIR

type W = { __archipen: { useDocStore: { getState: () => { doc: any; update: (fn: (d: any) => void) => void } }; useUi: { getState: () => any } } }
const docState = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)
const uiState = (page: Page) => page.evaluate(() => {
  const s = (window as unknown as W).__archipen.useUi.getState()
  return { viewport: s.viewport, selection: s.selection as string[], tool: s.tool as string }
})

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
      d.pages[0].zones.push({ id: 'z1', name: 'Cluster', description: '', x: 0, y: 0, w: 8, d: 6, color: '#5b7cfa', dashed: false })
      const n = (id: string, x: number, y: number) => ({ id, name: id.toUpperCase(), description: '', x, y, w: 2, d: 2, h: 1, color: '#2fb5a0', shape: 'block', iconPlacement: 'top', iconScale: 1, zoneId: 'z1' })
      d.pages[0].nodes.push(n('n1', 1, 1), n('n2', 5, 2))
    })
  })
  await page.keyboard.press('Shift+1')
})

test('space + drag pans, ctrl + wheel zooms', async ({ page }) => {
  const v0 = (await uiState(page)).viewport
  await page.mouse.move(700, 450)
  await page.keyboard.down('Space')
  await page.mouse.down()
  await page.mouse.move(800, 500, { steps: 5 })
  await page.mouse.up()
  await page.keyboard.up('Space')
  const v1 = (await uiState(page)).viewport
  expect(Math.round(v1.x - v0.x)).toBe(100)
  expect(Math.round(v1.y - v0.y)).toBe(50)
  expect((await docState(page)).pages[0].nodes[0].x).toBe(1) // nothing moved

  await page.keyboard.down('Control')
  await page.mouse.wheel(0, -100)
  await page.keyboard.up('Control')
  expect((await uiState(page)).viewport.zoom).toBeGreaterThan(v1.zoom)

  // plain wheel pans
  const v2 = (await uiState(page)).viewport
  await page.mouse.wheel(0, 120)
  expect((await uiState(page)).viewport.y).toBeLessThan(v2.y)
})

test('dragging a zone (by its label) carries its nodes, undo restores', async ({ page }) => {
  const label = await center(page, '[data-kind="zone"][data-label] text')
  await page.mouse.move(label.x, label.y)
  await page.mouse.down()
  await page.mouse.move(label.x + 160, label.y + 10, { steps: 8 })
  await page.mouse.up()
  const doc = await docState(page)
  const dx = doc.pages[0].zones[0].x
  expect(dx).not.toBe(0)
  expect(doc.pages[0].nodes[0].x - 1).toBe(dx)
  expect(doc.pages[0].nodes[1].x - 5).toBe(dx)
  await page.keyboard.press('Control+z')
  const back = await docState(page)
  expect(back.pages[0].zones[0].x).toBe(0)
  expect(back.pages[0].nodes[0].x).toBe(1)
})

test('alt-drag duplicates, delete removes, nodes leave zones', async ({ page }) => {
  const n1 = await center(page, '[data-id="n1"][data-label]')
  await page.mouse.click(n1.x, n1.y)
  expect((await uiState(page)).selection).toEqual(['n1'])
  const shape = await center(page, '.ap-nodes [data-id="n1"]')
  await page.keyboard.down('Alt')
  await page.mouse.move(shape.x, shape.y)
  await page.mouse.down()
  await page.mouse.move(shape.x + 300, shape.y + 200, { steps: 8 })
  await page.mouse.up()
  await page.keyboard.up('Alt')
  let doc = await docState(page)
  expect(doc.pages[0].nodes).toHaveLength(3)
  const copy = doc.pages[0].nodes.find((n: any) => !['n1', 'n2'].includes(n.id))
  expect(copy.zoneId).toBeUndefined() // dropped outside the zone
  expect(doc.pages[0].nodes.find((n: any) => n.id === 'n1').x).toBe(1)
  await page.keyboard.press('Delete')
  doc = await docState(page)
  expect(doc.pages[0].nodes).toHaveLength(2)
})

test('resize handle, double-click rename, marquee select', async ({ page }) => {
  const n2 = await center(page, '.ap-nodes [data-id="n2"]')
  await page.mouse.click(n2.x, n2.y)
  const handle = await center(page, '[data-handle="resize"]')
  await page.mouse.move(handle.x, handle.y)
  await page.mouse.down()
  await page.mouse.move(handle.x, handle.y + 90, { steps: 6 })
  await page.mouse.up()
  const n = (await docState(page)).pages[0].nodes.find((x: any) => x.id === 'n2')
  expect(n.w + n.d).toBeGreaterThan(4)

  await page.mouse.dblclick(n2.x, n2.y)
  const input = page.locator('textarea.ap-inline-edit')
  await expect(input).toBeVisible()
  await input.fill('Renamed')
  await input.press('Enter')
  await expect(page.locator('.ap-labels text', { hasText: 'Renamed' })).toHaveCount(1)

  // marquee from empty space selects both nodes
  await page.keyboard.press('Escape')
  const box = (await page.locator('[data-canvas]').boundingBox())!
  await page.mouse.move(box.x + 90, box.y + 80)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width - 360, box.y + box.height - 70, { steps: 8 })
  await page.mouse.up()
  const sel = (await uiState(page)).selection
  expect(sel).toEqual(expect.arrayContaining(['n1', 'n2']))
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-marquee.png` })
})

test('settings and shortcut dialogs open', async ({ page }) => {
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-shortcuts.png` })
  await page.keyboard.press('Escape')
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-settings') }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
  await page.getByRole('button', { name: 'Zones' }).click()
  await page.locator('[role=dialog] button[title="top"]').click()
  expect((await docState(page)).settings.labelDefaults.zone.side).toBe('top')
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/e2e-settings.png` })
})

test('the item panel follows the selection', async ({ page }) => {
  // nothing selected: no panel at all
  await expect(page.locator('aside')).toHaveCount(0)

  // selecting an item shows its panel
  const n1 = await center(page, '.ap-nodes [data-id="n1"]')
  await page.mouse.click(n1.x, n1.y)
  const item = page.locator('aside', { hasText: 'Node' })
  await expect(item).toBeVisible()
  await expect(page.locator('aside')).toHaveCount(1)

  // clicking empty canvas lets go of the item and leaves no panel behind
  const canvas = (await page.locator('[data-canvas]').boundingBox())!
  await page.mouse.click(canvas.x + canvas.width / 2, canvas.y + canvas.height - 30)
  await expect(page.locator('aside')).toHaveCount(0)

  // the item panel's X deselects
  await page.mouse.click(n1.x, n1.y)
  await item.getByRole('button', { name: 'Close panel' }).click()
  await expect(page.locator('aside')).toHaveCount(0)
  expect((await uiState(page)).selection).toEqual([])

  // Esc lets go of the selection and its panel
  await page.mouse.click(n1.x, n1.y)
  await expect(item).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('aside')).toHaveCount(0)
})

test('clicking the canvas does not draw the keyboard focus ring', async ({ page }) => {
  const canvas = page.locator('[data-canvas]')
  const ringShown = () => canvas.evaluate((el) => el.matches(':focus-visible') && !el.hasAttribute('data-pointer-focus'))
  await page.mouse.click(700, 600)
  await expect(canvas).toBeFocused()
  expect(await ringShown()).toBe(false)
  // Any key press hands the ring back to keyboard users.
  await page.keyboard.press('Shift')
  await expect(canvas).not.toHaveAttribute('data-pointer-focus')
})

/** A wire n1 → n3 running straight down, clear of n2, and the screen point at `t` along its line. */
async function straightWire(page: Page) {
  await page.evaluate(() => {
    const { useDocStore } = (window as unknown as W).__archipen
    useDocStore.getState().update((d) => {
      d.pages[0].nodes.push({ id: 'n3', name: 'N3', description: '', x: 1, y: 9, w: 2, d: 2, h: 1, color: '#2fb5a0', shape: 'block', iconPlacement: 'top', iconScale: 1 })
      d.pages[0].edges.push({ id: 'e1', name: '', description: '', from: { nodeId: 'n1' }, to: { nodeId: 'n3' }, waypoints: [], labelAt: 0.5 })
    })
  })
  await page.keyboard.press('Shift+1')
}
const pointOnWire = (page: Page, t: number) =>
  page.evaluate((t) => {
    const path = document.querySelector('.ap-edges [data-id="e1"] path.ap-hit') as SVGPathElement
    const q = path.getPointAtLength(path.getTotalLength() * t).matrixTransform(path.getScreenCTM()!)
    return { x: q.x, y: q.y }
  }, t)
const wire = async (page: Page) => (await docState(page)).pages[0].edges.find((e: any) => e.id === 'e1')

test('dragging a straight wire bends it; a click does not', async ({ page }) => {
  await straightWire(page)
  const mid = await pointOnWire(page, 0.5)
  await page.mouse.click(mid.x, mid.y)
  expect((await uiState(page)).selection).toEqual(['e1'])
  expect((await wire(page)).waypoints).toHaveLength(0)

  await page.mouse.move(mid.x, mid.y)
  await page.mouse.down()
  await page.mouse.move(mid.x, mid.y + 80, { steps: 6 })
  await page.mouse.up()
  expect((await wire(page)).waypoints).toHaveLength(1)

  await page.keyboard.press('ControlOrMeta+z')
  expect((await wire(page)).waypoints).toHaveLength(0)
})

test('dragging a wire end re-attaches it', async ({ page }) => {
  await straightWire(page)
  const mid = await pointOnWire(page, 0.5)
  await page.mouse.click(mid.x, mid.y)
  const handles = page.locator('[data-handle="end"]')
  await expect(handles).toHaveCount(2)

  const drag = async (to: { x: number; y: number }) => {
    const h = await center(page, '[data-handle="end"][data-index="1"]')
    await page.mouse.move(h.x, h.y)
    await page.mouse.down()
    await page.mouse.move(to.x, to.y, { steps: 8 })
    await page.mouse.up()
  }

  // Over empty space: nothing changes.
  const box = (await page.locator('[data-canvas]').boundingBox())!
  await drag({ x: box.x + 40, y: box.y + box.height - 40 })
  expect((await wire(page)).to).toEqual({ nodeId: 'n3' })

  // Onto the node at the other end: refused.
  await drag(await center(page, '.ap-nodes [data-id="n1"]'))
  expect((await wire(page)).to).toEqual({ nodeId: 'n3' })

  // Onto another node: re-attached.
  await drag(await center(page, '.ap-nodes [data-id="n2"]'))
  const e = await wire(page)
  expect(e.from).toEqual({ nodeId: 'n1' })
  expect(e.to).toEqual({ nodeId: 'n2' })
})
