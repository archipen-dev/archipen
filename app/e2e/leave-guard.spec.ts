import { expect, test } from '@playwright/test'

test('asks before leaving a diagram with changes not saved to a file', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'New diagram' }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  const editor = page.url()
  const home = page.getByRole('link', { name: 'All diagrams' })

  // Cancel stays on the diagram
  const messages: string[] = []
  page.once('dialog', (d) => {
    messages.push(d.message())
    void d.dismiss()
  })
  await home.click()
  await expect.poll(() => messages.length).toBe(1)
  expect(messages[0]).toContain('aren’t saved to a file')
  await expect(page).toHaveURL(editor)
  await expect(page.locator('[data-canvas]')).toBeVisible()

  // OK leaves
  page.once('dialog', (d) => void d.accept())
  await home.click()
  await expect(page.getByRole('button', { name: 'New diagram' })).toBeVisible()
  expect(messages).toHaveLength(1)
})
