import { Check, TriangleAlert } from 'lucide-react'
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../lib/cx'

type Tone = 'neutral' | 'error'
interface ToastItem {
  id: number
  message: string
  tone: Tone
}

interface ToastApi {
  show: (message: string, tone?: Tone) => void
}

const ToastContext = createContext<ToastApi>({ show: () => {} })

export function useToast(): ToastApi {
  return useContext(ToastContext)
}

/** Quiet, bottom-placed, short messages. Icons only for status. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const nextId = useRef(1)

  const show = useCallback((message: string, tone: Tone = 'neutral') => {
    const id = nextId.current++
    setToasts((list) => [...list.slice(-2), { id, message, tone }])
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3500)
  }, [])

  const value = useMemo(() => ({ show }), [show])

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+8rem)] z-50 flex flex-col items-center gap-2 px-4 md:bottom-24 lg:bottom-6"
        role="status"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={cx(
              'pointer-events-auto flex max-w-md animate-rise items-center gap-3 rounded-md border bg-raised px-4 py-3 text-body-sm text-ink shadow-float',
              toast.tone === 'error' ? 'border-danger' : 'border-control',
            )}
          >
            {toast.tone === 'error' ? (
              <TriangleAlert size={18} strokeWidth={1.75} className="shrink-0 text-danger" aria-hidden="true" />
            ) : (
              <Check size={18} strokeWidth={1.75} className="shrink-0 text-success" aria-hidden="true" />
            )}
            <span>{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
