import { X } from 'lucide-react'
import { cx } from '../lib/cx'
import type { Toast } from '../store/toastStore'
import { Button } from './Button'

/** The stack of messages at the bottom of the screen. Presentational: the app passes the toasts in. */
export function Toasts({ toasts, onDismiss }: { toasts: Toast[]; onDismiss: (id: number) => void }) {
  return (
    <div className="pointer-events-none fixed bottom-5 left-1/2 z-50 flex -translate-x-1/2 flex-col items-center gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          role="status"
          className={cx('ap-enter ap-float flex items-center gap-2 rounded-xl text-[12.5px] font-medium', t.action ? 'pointer-events-auto py-1.5 pr-1.5 pl-3.5' : 'px-3.5 py-2', t.tone === 'error' ? 'text-red-500' : 'text-ink')}
        >
          {t.text}
          {t.action && (
            <>
              <Button
                size="sm"
                variant="primary"
                onClick={() => {
                  onDismiss(t.id)
                  t.action!.run()
                }}
              >
                {t.action.label}
              </Button>
              <Button size="sm" className="w-7 px-0" aria-label="Dismiss" onClick={() => onDismiss(t.id)}>
                <X size={14} />
              </Button>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
