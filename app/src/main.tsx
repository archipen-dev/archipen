// Must run before the router reads the URL.
import './io/pairingFromUrl'
import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { installBridgeHost } from './app/bridgeHost'
import { registerServiceWorker } from './app/pwa'
import { queryClient, router } from './app/router'
import { startBridge } from './io/aiBridge'
import './index.css'
import { useDocStore } from './store/docStore'
import { useUi } from './store/uiStore'

// Handy for debugging and end-to-end tests.
if (import.meta.env.DEV) Object.assign(window, { __archipen: { useDocStore, useUi } })

registerServiceWorker()
installBridgeHost()
startBridge()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
)
