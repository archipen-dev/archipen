import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

// The browser export and the headless renderer (render/) share one SVG builder, so their files must be identical.
const repo = new URL('../../', import.meta.url)
const cli = new URL('render/dist/cli.mjs', repo)

test.beforeAll(() => {
  if (!existsSync(cli)) execFileSync('npm', ['run', 'build', '-w', 'render'], { cwd: repo, stdio: 'ignore' })
})

for (const example of ['web-shop', 'kubernetes-cluster']) {
  test(`SVG export of ${example} matches the CLI byte for byte`, async ({ page }) => {
    const path = new URL(`examples/${example}.archipen.json`, repo)
    const text = readFileSync(path, 'utf8')
    await page.goto('/')
    const dt = await page.evaluateHandle(([t]) => {
      const d = new DataTransfer()
      d.items.add(new File([t], 'diagram.archipen.json', { type: 'application/json' }))
      return d
    }, [text])
    await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })
    await expect(page.locator('.ap-nodes [data-kind="node"]').first()).toBeVisible()

    await page.getByRole('button').filter({ has: page.locator('svg.lucide-download') }).first().click()
    const [dl] = await Promise.all([page.waitForEvent('download'), page.getByRole('menuitem', { name: /SVG.*font embedded/ }).click()])
    const fromBrowser = readFileSync((await dl.path())!, 'utf8')

    const fromCli = execFileSync('node', [cli.pathname, 'export', path.pathname, '--format', 'svg', '--theme', 'light'], { encoding: 'utf8' })
    expect(fromBrowser).toBe(fromCli)
  })
}
