import { expect, test } from '@playwright/test'
import { CSP } from '../csp.ts'
import { serveProdBuild, type ProdServer } from './prodServer.ts'

// One production build must run under any URL path, with no rewrites on the server:
// serve it under /a/b/ from a plain static file server, with the same CSP header as deploy/Caddyfile.
const BASE = '/a/b/'

let server: ProdServer
let origin = ''

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  test.setTimeout(180_000)
  server = await serveProdBuild('subpath-dist', BASE)
  origin = server.origin
})

test.afterAll(() => server?.close())

test('the build works under a sub-path: open, reload and share', async ({ page, browser, context }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // Anything the CSP blocks shows up as a console error.
  page.on('console', (m) => m.type() === 'error' && /Content Security Policy/i.test(m.text()) && errors.push(m.text()))
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])

  await page.goto(`${origin}${BASE}`)
  expect(await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute('content')).toBe(CSP)
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Web app/ }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await expect(page).toHaveURL(new RegExp(`${BASE}#/d/`))

  // Reload on a diagram route: still served from the same folder.
  await page.reload()
  await expect(page.locator('.ap-labels text', { hasText: 'Postgres' })).toHaveCount(1)
  // The vendor credits link resolves inside the sub-path too.
  expect(await page.evaluate(() => new URL('vendor-icon-credits.txt', location.href).pathname)).toBe(`${BASE}vendor-icon-credits.txt`)

  // Exports work under the CSP: PNG draws the SVG from a blob URL, PDF loads the fonts.
  for (const [name, magic] of [[/PNG.*2×/, '\x89PNG'], ['PDF', '%PDF-']] as const) {
    const download = page.waitForEvent('download')
    await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
    await page.getByRole('menuitem', { name }).click()
    const bytes = Buffer.concat(await (await (await download).createReadStream()).toArray())
    expect(bytes.subarray(0, magic.length).toString('latin1')).toBe(magic)
  }

  await page.getByRole('button').filter({ has: page.locator('svg.lucide-link-2') }).click()
  await page.getByRole('menuitem', { name: /Copy link/ }).click()
  await expect(page.getByText(/link copied/i)).toBeVisible()
  const url: string = await page.evaluate(() => navigator.clipboard.readText())
  expect(url.startsWith(`${origin}${BASE}#/share#1.`)).toBe(true)

  const fresh = await browser.newContext()
  const other = await fresh.newPage()
  await other.goto(url)
  await expect(other.locator('.ap-labels text', { hasText: 'Postgres' })).toHaveCount(1)
  await fresh.close()
  expect(errors).toEqual([])
})

test('the app refuses to be shown in a frame', async ({ page }) => {
  const refused = page.waitForEvent('console', (m) => /frame-ancestors/.test(m.text()))
  await page.goto(`${origin}${BASE}vendor-icon-credits.txt`)
  await page.setContent(`<iframe src="${origin}${BASE}"></iframe>`)
  await refused
  expect(page.frames()[1]?.url() ?? '').not.toContain('#/')
})
