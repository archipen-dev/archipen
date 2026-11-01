import { registerSW } from 'virtual:pwa-register'
import { toast } from '../store/toastStore'

const HOUR = 60 * 60 * 1000

/**
 * Register the service worker that keeps the app working offline (see `pwa()` in vite.config.ts). A new version
 * waits until the user clicks Reload, so an open diagram is never swapped out from under them.
 * Does nothing in `vite dev`.
 */
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return
  const update = registerSW({
    onNeedRefresh: () => toast('A new version of Archipen is available.', 'info', { label: 'Reload', run: () => void update(true) }),
    onOfflineReady: () => toast('Archipen now works offline.'),
    // A tab can stay open for days: look for a new version now and then.
    onRegisteredSW: (_url, reg) => reg && setInterval(() => navigator.onLine && void reg.update(), HOUR),
  })
}
