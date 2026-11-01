import { readFileSync } from 'node:fs'
import { expect, test, type Page } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any } }; useUi: { getState: () => any } } }
const docState = (page: Page) => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)

const KUBERNETES_BLUE = '#326ce5'

/** Open a diagram with a white block, so the Kubernetes logo keeps its brand colour. */
async function openWithWhiteNode(page: Page, icon?: string) {
  const text = JSON.stringify({ format: 'archipen', name: 'Vendors', pages: [{ id: 'p', nodes: [{ id: 'k', name: 'Cluster', x: 0, y: 0, color: '#ffffff', ...(icon ? { icon } : {}) }] }] })
  await page.goto('/')
  const dt = await page.evaluateHandle(([t]) => {
    const d = new DataTransfer()
    d.items.add(new File([t], 'vendors.archipen.json', { type: 'application/json' }))
    return d
  }, [text])
  await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(1)
}

test('pick a vendor icon in the picker; it draws in brand colour', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await openWithWhiteNode(page)
  await page.evaluate(() => (window as unknown as W).__archipen.useUi.getState().select(['k']))

  await page.getByRole('button', { name: 'None', exact: true }).click()
  await page.getByPlaceholder('Search icons').fill('kube')
  await page.getByRole('button', { name: 'Kubernetes', exact: true }).click()

  expect((await docState(page)).pages[0].nodes[0].icon).toBe('vendor:kubernetes')
  await expect(page.locator(`.ap-nodes [data-id="k"] g[fill="${KUBERNETES_BLUE}"] path`)).toHaveCount(1)
  // The picker trigger now shows the brand name.
  await expect(page.getByRole('button', { name: 'Kubernetes', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('SVG export keeps the vendor logo filled in brand colour', async ({ page }) => {
  await openWithWhiteNode(page, 'vendor:kubernetes')
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem').filter({ hasText: 'SVG' }).filter({ hasText: 'small' }).click()])
  const svg = readFileSync((await dl.path())!, 'utf8')
  expect(svg).toContain(`fill="${KUBERNETES_BLUE}"`)
})

test('the remaining vendor logos load only when the picker opens', async ({ page }) => {
  const requested: string[] = []
  page.on('request', (r) => r.url().includes('vendorPathsRest') && requested.push(r.url()))
  await openWithWhiteNode(page, 'vendor:kubernetes') // a core logo
  await expect(page.locator(`.ap-nodes [data-id="k"] g[fill="${KUBERNETES_BLUE}"] path`)).toHaveCount(1)
  expect(requested).toEqual([])

  await page.evaluate(() => (window as unknown as W).__archipen.useUi.getState().select(['k']))
  await page.getByRole('button', { name: 'Kubernetes', exact: true }).click()
  await page.getByPlaceholder('Search icons').fill('hetzner')
  await expect(page.getByRole('button', { name: 'Hetzner', exact: true }).locator('svg path')).toHaveCount(1)
  expect(requested.length).toBeGreaterThan(0)
})

test('a diagram using a non-core logo loads and draws it right away', async ({ page }) => {
  await openWithWhiteNode(page, 'vendor:hetzner')
  await expect(page.locator('.ap-nodes [data-id="k"] g[fill] path')).toHaveCount(1)
})
