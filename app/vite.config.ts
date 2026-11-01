/// <reference types="vitest/config" />
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { CSP } from './csp.ts'
import { thirdPartyNotices } from '../scripts/vite-notices.mjs'

/** Put the Content-Security-Policy into the built index.html (see csp.ts). */
const cspMeta = (): Plugin => ({
  name: 'archipen-csp',
  apply: 'build',
  transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: CSP }, injectTo: 'head-prepend' }],
})

/**
 * Service worker and web app manifest, so the app installs and works offline. The worker precaches the whole build
 * (every lazy chunk too, like the icon picker and PDF export); src/app/pwa.ts registers it and asks before updating.
 */
const pwa = () =>
  VitePWA({
    registerType: 'prompt',
    injectRegister: false, // registered from our own code: the CSP allows no inline script
    includeAssets: ['apple-touch-icon.png'], // the manifest icons are added by the plugin, the rest by globPatterns
    manifest: {
      name: 'Archipen',
      short_name: 'Archipen',
      description: 'Isometric architecture diagrams in the browser',
      start_url: './',
      scope: './',
      display: 'standalone',
      background_color: '#f5f4f0',
      theme_color: '#f5f4f0',
      icons: [
        { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        { src: 'favicon.svg', sizes: 'any', type: 'image/svg+xml' },
      ],
    },
    workbox: {
      globPatterns: ['**/*.{js,css,html,svg,woff2,ttf,txt}'],
      maximumFileSizeToCacheInBytes: 8 * 1024 * 1024,
      navigateFallback: 'index.html',
      cleanupOutdatedCaches: true,
    },
  })

export default defineConfig({
  // Relative asset URLs: the build runs under any URL path, chosen by whoever hosts it.
  base: './',
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), cspMeta(), thirdPartyNotices({ title: 'Archipen: third-party notices' }), pwa()],
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
  },
})
