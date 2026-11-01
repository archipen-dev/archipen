import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { expect, test } from '@playwright/test'

const examples = fileURLToPath(new URL('../../examples/', import.meta.url))

// Hand-written files from examples/ (the documented file format) must open and render.
for (const name of readdirSync(examples).filter((f) => f.endsWith('.json'))) {
  test(`opens examples/${name}`, async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(String(e)))
    const text = readFileSync(`${examples}${name}`, 'utf8')
    const json = JSON.parse(text)

    await page.goto('/')
    const dt = await page.evaluateHandle(
      ([t, n]) => {
        const d = new DataTransfer()
        d.items.add(new File([t], n, { type: 'application/json' }))
        return d
      },
      [text, name] as const,
    )
    await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })

    await expect(page.locator('[data-canvas]')).toBeVisible()
    await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(json.pages[0].nodes.length)
    if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/${name}.png` })
    expect(errors).toEqual([])
  })
}
