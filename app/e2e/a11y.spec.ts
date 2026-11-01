import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

// Automated accessibility checks (axe-core, WCAG 2.1 A/AA). They catch missing names, roles and contrast
// problems in the HTML UI and the diagram canvas.
async function violations(page: Page) {
  // Contrast is measured on what is painted: let fade-ins finish first (looping animations never do).
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getTiming().iterations === Infinity),
  )
  const { violations } = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze()
  return violations
    .filter((v) => v.impact === 'serious' || v.impact === 'critical')
    .map((v) => `${v.id} (${v.impact}): ${v.help}\n  ${v.nodes.map((n) => n.target.join(' ')).slice(0, 5).join('\n  ')}`)
}

test('home page', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByRole('region', { name: 'Templates' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('editor with a diagram', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Kubernetes cluster/ }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('keyboard shortcuts dialog', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await page.keyboard.press('?')
  await expect(page.getByRole('dialog', { name: 'Keyboard shortcuts' })).toBeVisible()
  expect(await violations(page)).toEqual([])
})

test('canvas: Tab steps through named items and then lets focus move on', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Kubernetes cluster/ }).click()
  const canvas = page.getByRole('application')
  await expect(canvas).toBeVisible()
  await expect(canvas).toHaveAccessibleDescription(/Diagram with \d+ nodes/)
  await canvas.focus()

  await page.keyboard.press('Tab')
  const active = await canvas.getAttribute('aria-activedescendant')
  expect(active).toBeTruthy()
  await expect(page.locator(`[id="${active}"]`)).toHaveAttribute('aria-label', /\S/)
  await expect(canvas).toBeFocused()

  await page.keyboard.press('Tab')
  const second = await canvas.getAttribute('aria-activedescendant')
  expect(second).not.toBe(active)
  expect(await violations(page)).toEqual([])

  // Back past the first item: the selection clears and focus leaves the canvas.
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Shift+Tab')
  await expect(canvas).not.toHaveAttribute('aria-activedescendant')
  await expect(canvas).not.toBeFocused()
})

test('canvas: edits are announced', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Kubernetes cluster/ }).click()
  const canvas = page.getByRole('application')
  await canvas.focus()
  const live = page.locator('[aria-live="polite"]').first()
  await page.keyboard.press('Tab')
  await page.keyboard.press('Delete')
  await expect(live).toContainText('Deleted Zone ')
  await page.keyboard.press('ControlOrMeta+z')
  await expect(live).toContainText('Added Zone ')
})
