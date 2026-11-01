import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { expect, test, type Page } from '@playwright/test'

// The MCP server (mcp/dist/cli.mjs, from `npm run build:mcp`) driven over stdio like an AI client would, paired
// with the editor through a link.
const cli = fileURLToPath(new URL('../../mcp/dist/cli.mjs', import.meta.url))
const minimal = readFileSync(new URL('../../examples/minimal.archipen.json', import.meta.url), 'utf8')
const TOKEN = 'e2e-token-0123456789'

test.describe.configure({ mode: 'serial' })

let client: Client
let port: number

test.beforeAll(async ({ baseURL }) => {
  port = 20000 + Math.floor(Math.random() * 20000)
  client = new Client({ name: 'e2e', version: '1' })
  const env = { ...process.env, ARCHIPEN_MCP_PORT: String(port), ARCHIPEN_MCP_TOKEN: TOKEN, ARCHIPEN_MCP_ORIGINS: new URL(baseURL!).origin, ARCHIPEN_APP_URL: baseURL! } as Record<string, string>
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [cli], env, stderr: 'ignore' }))
})

test.afterAll(() => client?.close())

const call = async (name: string, args: Record<string, unknown> = {}) => {
  const r = (await client.callTool({ name, arguments: args })) as { content: { type: string; text?: string }[]; isError?: boolean }
  return { error: !!r.isError, text: r.content.map((c) => c.text ?? '').join('\n') }
}

async function openDiagram(page: Page) {
  const dt = await page.evaluateHandle((t) => {
    const d = new DataTransfer()
    d.items.add(new File([t], 'minimal.archipen.json', { type: 'application/json' }))
    return d
  }, minimal)
  await page.locator('.ap-scroll').first().dispatchEvent('drop', { dataTransfer: dt })
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(2)
}

test('the AI edits the open diagram and the user can undo it', async ({ page }) => {
  await page.goto(`/#/?mcp=${port}.${TOKEN}`)
  await expect(page.getByText('Connected to the AI')).toBeVisible()
  expect(page.url()).not.toContain('mcp=')
  await openDiagram(page)
  await expect(page.getByTestId('ai-status')).toHaveAttribute('data-status', 'connected')

  const got = JSON.parse((await call('get_diagram')).text)
  expect(got.doc.name).toBe('Minimal')
  const patched = await call('patch_diagram', { ops: [{ op: 'add', path: '/pages/0/nodes/-', value: { id: 'cache', name: 'Cache', x: 0, y: 4 } }], expectRevision: got.revision })
  expect(patched.error).toBe(false)
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(3)

  const bad = await call('patch_diagram', { ops: [{ op: 'add', path: '/pages/0/nodes/-', value: { id: 'app', x: 9, y: 9 } }] })
  expect(bad.error).toBe(true)
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(3)

  await page.keyboard.press('ControlOrMeta+z')
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(2)
})

test('from the start page, the AI creates a diagram and the tab opens it', async ({ page }) => {
  await page.goto(`/#/?mcp=${port}.${TOKEN}`)
  await expect(page.getByText('Ask it to create a diagram or open one of yours')).toBeVisible()
  await expect(page.getByTestId('ai-status')).toHaveText('AI connected')
  if (process.env.SHOTS_DIR) await page.screenshot({ path: `${process.env.SHOTS_DIR}/home-ai-connected.png`, clip: { x: 0, y: 0, width: 700, height: 120 } })
  expect(JSON.parse((await call('connection_status')).text)).toMatchObject({ screen: 'other', diagram: null })
  expect((await call('get_diagram')).text).toContain('new_diagram')

  const doc = JSON.parse(minimal)
  doc.name = 'From the AI'
  const created = await call('new_diagram', { doc })
  expect(created.error).toBe(false)
  await expect(page).toHaveURL(/#\/d\//)
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(2)
  expect(JSON.parse((await call('get_diagram')).text).doc.name).toBe('From the AI')

  await call('new_diagram', { name: 'Second' })
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(0)
  const list = JSON.parse((await call('list_diagrams')).text) as { id: string; name: string }[]
  const first = list.find((d) => d.name === 'From the AI')!
  await call('open_diagram', { id: first.id })
  await expect(page.locator('.ap-nodes [data-kind="node"]')).toHaveCount(2)
})

test('pairing with a code keeps the diagram on screen', async ({ page }) => {
  await page.goto('/')
  await openDiagram(page)
  const url = page.url()
  await page.getByTestId('ai-status').click()
  await page.getByLabel('Pairing code').fill(`${port}.${TOKEN}`)
  await page.getByRole('button', { name: 'Connect', exact: true }).click()
  await expect(page.getByTestId('ai-status')).toHaveAttribute('data-status', 'connected')
  expect(page.url()).toBe(url)
  expect(JSON.parse((await call('get_diagram')).text).doc.name).toBe('Minimal')
})

test('an old pairing link is refused, and the app says so', async ({ page }) => {
  await page.goto(`/#/?mcp=${port}.not-the-right-token`)
  await expect(page.getByText('refused this pairing link')).toBeVisible()
  await openDiagram(page)
  await expect(page.getByTestId('ai-status')).toHaveAttribute('data-status', 'rejected')
})

test('a server that is not running is reported', async ({ page }) => {
  await page.goto(`/#/?mcp=${port + 1}.${TOKEN}`)
  await expect(page.getByText(`Can't reach the Archipen MCP server on port ${port + 1}`)).toBeVisible()
  await openDiagram(page)
  await expect(page.getByTestId('ai-status')).toHaveAttribute('data-status', 'unreachable')
})
