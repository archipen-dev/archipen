import { X } from 'lucide-react'
import { Dialog } from 'radix-ui'
import type { ReactNode } from 'react'
import { Button } from './Button'

export interface DialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  width?: number
  children: ReactNode
}

/** Centred modal with a title bar and a scrolling body. */
export function DialogShell({ open, onOpenChange, title, children, width = 520 }: DialogShellProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-black/25 backdrop-blur-[2px] data-[state=open]:animate-[ap-rise_0.2s_ease-out]" />
        <Dialog.Content
          style={{ width }}
          className="ap-enter fixed top-1/2 left-1/2 z-50 flex max-h-[min(720px,88vh)] max-w-[calc(100vw-32px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-line bg-panel-solid shadow-float outline-none"
        >
          <div className="flex h-13 shrink-0 items-center justify-between border-b border-line px-5">
            <Dialog.Title className="font-display text-[16px] font-semibold tracking-tight text-ink">{title}</Dialog.Title>
            <Dialog.Close asChild>
              <Button size="icon" aria-label="Close">
                <X className="size-4" />
              </Button>
            </Dialog.Close>
          </div>
          <Dialog.Description className="sr-only">{title}</Dialog.Description>
          {/* Focusable, so keyboard users can scroll long dialogs. */}
          <div tabIndex={0} className="ap-scroll min-h-0 flex-1 overflow-y-auto focus-visible:outline-none">
            {children}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
