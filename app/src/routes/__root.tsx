import type { QueryClient } from '@tanstack/react-query'
import { createRootRouteWithContext, Outlet } from '@tanstack/react-router'
import { Tooltip } from 'radix-ui'
import { useEffect } from 'react'
import { useResolvedTheme } from '../store/theme'
import { dismissToast, useToasts } from '../store/toastStore'
import { Toasts } from '../ui'

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: Root,
})

function Root() {
  const theme = useResolvedTheme()
  const toasts = useToasts((s) => s.toasts)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])
  return (
    <Tooltip.Provider>
      <Outlet />
      <Toasts toasts={toasts} onDismiss={dismissToast} />
    </Tooltip.Provider>
  )
}
