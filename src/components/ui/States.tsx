import { WifiOff } from 'lucide-react'
import type { ReactNode } from 'react'
import { cx } from '../../lib/cx'
import { Mountains } from './Art'
import { Button } from './Button'

interface EmptyStateProps {
  title: string
  children?: ReactNode
  action?: ReactNode
  className?: string
}

/** Empty states teach what to do next, over a quiet mountain ridge. */
export function EmptyState({ title, children, action, className }: EmptyStateProps) {
  return (
    <div className={cx('relative overflow-hidden rounded-lg border border-line bg-surface', className)}>
      <div className="absolute inset-x-0 bottom-0 h-32 opacity-90 md:h-40">
        <Mountains />
      </div>
      <div className="relative px-6 pt-10 pb-36 md:pb-44">
        <h2 className="text-headline font-semibold text-ink">{title}</h2>
        {children && <p className="mt-2 max-w-md text-body text-muted">{children}</p>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  )
}

interface ErrorStateProps {
  title?: string
  message: string
  onRetry?: () => void
  offline?: boolean
  className?: string
}

/** A failed load: says what happened and offers the way back. */
export function ErrorState({ title = "That didn't load", message, onRetry, offline, className }: ErrorStateProps) {
  return (
    <div role="alert" className={cx('rounded-lg border border-line bg-surface px-6 py-8', className)}>
      {offline && <WifiOff size={22} strokeWidth={1.75} className="mb-3 text-muted" aria-hidden="true" />}
      <h2 className="text-headline font-semibold text-ink">{offline ? "You're offline" : title}</h2>
      <p className="mt-2 max-w-md text-body text-muted">{message}</p>
      {onRetry && (
        <Button variant="secondary" size="md" className="mt-5" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  )
}
