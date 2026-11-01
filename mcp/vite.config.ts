/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { thirdPartyNotices } from '../scripts/vite-notices.mjs'

// Bundles the server with the app sources it shares (the file schema and checks, the bridge protocol) into plain
// Node modules in dist/. Packages listed as dependencies stay external.
const external = ['@modelcontextprotocol/sdk', '@archipen/render', 'ws', 'fast-json-patch', 'zod']

export default defineConfig({
  plugins: [thirdPartyNotices({ title: '@archipen/mcp: third-party notices' })],
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: { index: 'src/index.ts', cli: 'src/cli.ts' },
      external: (id) => external.some((e) => id === e || id.startsWith(e + '/')) || id.startsWith('node:'),
      output: { format: 'es', entryFileNames: '[name].mjs', chunkFileNames: 'chunks/[name]-[hash].mjs' },
    },
  },
  ssr: { noExternal: true },
  test: { include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30000 },
})
