/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { thirdPartyNotices } from '../scripts/vite-notices.mjs'

// Bundles the CLI, server and API together with the app sources they share (geometry, model, render)
// into plain Node modules in dist/. Packages listed as dependencies stay external.
const external = ['@resvg/resvg-js', 'jsdom', 'pdfkit', 'svg-to-pdfkit', 'react', 'react-dom', 'react-dom/server', 'react/jsx-runtime']

export default defineConfig({
  plugins: [thirdPartyNotices({ title: '@archipen/render: third-party notices' })],
  build: {
    ssr: true,
    target: 'node22',
    outDir: 'dist',
    emptyOutDir: true,
    minify: false,
    rollupOptions: {
      input: { index: 'src/index.ts', cli: 'src/cli.ts', server: 'src/server.ts', worker: 'src/worker.ts' },
      external: (id) => external.some((e) => id === e || id.startsWith(e + '/')) || id.startsWith('node:'),
      // env.ts must run before React loads, so it gets its own chunk, imported ahead of react.
      output: { format: 'es', entryFileNames: '[name].mjs', chunkFileNames: 'chunks/[name]-[hash].mjs', manualChunks: (id) => (id.endsWith('/src/env.ts') ? 'env' : undefined) },
    },
  },
  ssr: { noExternal: true },
  test: { include: ['test/**/*.test.ts'], environment: 'node', testTimeout: 30000 },
})
