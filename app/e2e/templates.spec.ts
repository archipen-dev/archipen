import { expect, test } from '@playwright/test'

type W = { __archipen: { useDocStore: { getState: () => { doc: any } } } }

test('opening a template creates an editable copy', async ({ page }) => {
  await page.goto('/')
  const gallery = page.getByRole('region', { name: 'Templates' })
  await expect(gallery.getByRole('button')).toHaveCount(5)
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/home-templates.png`, fullPage: true })

  await gallery.getByRole('button', { name: /Kubernetes cluster/ }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  const doc = await page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc)
  expect(doc.name).toBe('Kubernetes cluster')
  expect(doc.pages[0].nodes.length).toBe(10)
  await expect(page.locator('[data-kind="node"]').first()).toBeVisible()
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/k8s-template.png` })

  // a second copy gets its own id, so both show up under Recent
  await page.goto('/')
  await page.getByRole('region', { name: 'Templates' }).getByRole('button', { name: /Kubernetes cluster/ }).click()
  await expect(page.locator('[data-canvas]')).toBeVisible()
  await expect.poll(() => page.evaluate(() => (window as unknown as W).__archipen.useDocStore.getState().doc?.id)).not.toBe(doc.id)
})
