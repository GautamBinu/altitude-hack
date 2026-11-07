import { X } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'

interface SheetProps {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  footer?: ReactNode
}

/**
 * Bottom sheet on phones, side panel from tablet up (see dialog.sheet in index.css).
 * Built on the native <dialog>, which gives us the focus trap, Escape to close and an inert page behind.
 */
export function Sheet({ open, onClose, title, children, footer }: SheetProps) {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  // The page behind should not scroll while a sheet is open.
  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // A click on the backdrop lands on the dialog element itself.
        if (event.target === event.currentTarget) onClose()
      }}
    >
      {open && (
        <>
          <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-3 md:px-6">
            <h2 id={titleId} className="min-w-0 pt-1 text-headline font-semibold text-ink">
              {title}
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="-mr-2 grid size-11 shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-raised hover:text-ink"
            >
              <X size={22} strokeWidth={1.75} aria-hidden="true" />
            </button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 md:px-6">{children}</div>
          {footer && <footer className="border-t border-line bg-surface px-4 pt-3 pb-safe md:px-6">{footer}<div className="h-3" /></footer>}
        </>
      )}
    </dialog>
  )
}
