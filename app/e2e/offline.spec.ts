import { expect, test } from '@playwright/test'
import { serveProdBuild, type ProdServer } from './prodServer.ts'

// The service worker stores the whole build on the first visit, so the app keeps working with the server gone:
// reload, edit, load the lazy parts (the full vendor logo set, PDF export) and keep the edits across reloads.
// Served under a sub-path, so this also checks the worker's scope there.
const BASE = '/offline/app/'

let server: ProdServer

test.beforeAll(async () => {
  test.setTimeout(180_000)
  server = await serveProdBuild('offline-dist', BASE)
})

test.afterAll(() => server?.close())

test('the app works offline after the first visit', async ({ page, context }) => {
  test.setTimeout(60_000)
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('dialog', (d) => void d.accept()) // the tab-close warning for changes not saved to a file

  await page.goto(`${server.origin}${BASE}`)
  await expect(page.getByText('Archipen now works offline.')).toBeVisible()
  expect(await page.evaluate(() => navigator.serviceWorker.ready.then((r) => new URL(r.scope).pathname))).toBe(BASE)
  const manifest = await page.evaluate(() => fetch(document.querySelector<HTMLLinkElement>('link[rel=manifest]')!.href).then((r) => r.json()))
  expect(manifest).toMatchObject({ name: 'Archipen', display: 'standalone', start_url: './' })

  await server.close()
  // The network is gone too (Chromium's offline mode doesn't reach the worker, the closed server does).
  await context.setOffline(true)

  // Open a diagram with one plain node, from a file dropped on the home page.
  await page.reload()
  const text = JSON.stringify({ format: 'archipen', name: 'Offline', pages: [{ id: 'p', nodes: [{ id: 'k', name: 'Box', x: 0, y: 0, color: '#ffffff' }] }] })
  const dt = await page.evaluateHandle(([t]) => {
    const d = new DataTransfer()
    d.items.add(new File([t], 'offline.archipen.json', { type: 'application/json' }))
    return d
  }, [text])
  await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })
  const node = page.locator('.ap-nodes [data-id="k"]')
  await expect(node).toHaveCount(1)

  // A logo outside the core set: its chunk was never loaded online, so it must come from the worker's cache.
  await node.click()
  await page.getByRole('button', { name: 'None', exact: true }).click()
  await page.getByPlaceholder('Search icons').fill('hetzner')
  await page.getByRole('button', { name: 'Hetzner', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Hetzner', exact: true })).toBeVisible()
  await page.keyboard.press('Escape')

  // PDF export loads jsPDF and the fonts lazily.
  const download = page.waitForEvent('download')
  await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
  await page.getByRole('menuitem', { name: 'PDF' }).click()
  const bytes = Buffer.concat(await (await (await download).createReadStream()).toArray())
  expect(bytes.subarray(0, 5).toString('latin1')).toBe('%PDF-')

  // The edit survives a reload, still offline.
  await page.reload()
  await expect(page.locator('.ap-nodes [data-id="k"]')).toHaveCount(1)
  await page.locator('.ap-nodes [data-id="k"]').click()
  await expect(page.getByRole('button', { name: 'Hetzner', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})

test('a new version waits for the Reload button', async ({ page }) => {
  test.setTimeout(180_000)
  const app = await serveProdBuild('update-dist', BASE)
  try {
    await page.goto(`${app.origin}${BASE}`)
    await expect(page.getByText('Archipen now works offline.')).toBeVisible()
    // A later visit: now the worker serves the page.
    await page.reload()
    await expect(page.locator('.ap-scroll').first()).toBeVisible()
    await page.evaluate(() => Object.assign(window, { notReloaded: true }))

    await app.rebuild('2')
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r?.update()))
    const notice = page.getByText('A new version of Archipen is available.')
    await expect(notice).toBeVisible()
    // Nothing reloaded on its own, and the old version still answers.
    expect(await page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded)).toBe(true)
    expect(await page.evaluate(() => fetch('build-marker.txt').then((r) => r.text()))).toBe('1')

    // Wait for the reload itself: right after the click the old page is still there.
    const reloaded = page.waitForEvent('load')
    await page.getByRole('button', { name: 'Reload' }).click()
    await reloaded
    await expect(page.locator('.ap-scroll').first()).toBeVisible()
    expect(await page.evaluate(() => (window as unknown as { notReloaded?: boolean }).notReloaded)).toBeUndefined()
    expect(await page.evaluate(() => fetch('build-marker.txt').then((r) => r.text()))).toBe('2')
  } finally {
    await app.close()
  }
})
