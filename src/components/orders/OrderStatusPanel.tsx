import type { OrderView } from '@shared/types'
import { Link } from 'react-router'
import { cx } from '../../lib/cx'
import { OrderTracker } from '../OrderTracker'
import { useOrderCopy } from '../useOrderCopy'

interface OrderStatusPanelProps {
  order: OrderView
  /** Link the heading to the order screen. */
  linked?: boolean
  headingLevel?: 'h1' | 'h2'
  className?: string
}

/** Order number, the plain-language answer, and the climb. The answer to "where is my order" in one glance. */
export function OrderStatusPanel({ order, linked = false, headingLevel = 'h2', className }: OrderStatusPanelProps) {
  const copy = useOrderCopy(order)
  const Heading = headingLevel
  const ready = order.status === 'ready'
  const number = (
    <Heading className="font-display text-display-lg font-bold leading-none tnum">Order #{order.number}</Heading>
  )

  return (
    <section
      aria-label={`Order ${order.number}`}
      className={cx(
        'rounded-lg border bg-surface p-5 md:p-6',
        ready ? 'border-accent shadow-band' : 'border-line',
        className,
      )}
    >
      {linked ? (
        <Link to={`/orders/${order.id}`} className="inline-block rounded-sm underline-offset-4 hover:underline">
          {number}
        </Link>
      ) : (
        number
      )}

      <p className="mt-4 text-headline font-semibold leading-tight text-ink" aria-live="polite">
        {copy.headline}
        {copy.detail && <span className="block text-muted">{copy.detail}</span>}
      </p>

      {order.status !== 'cancelled' && <OrderTracker status={order.status} className="mx-auto mt-6 max-w-136" />}
    </section>
  )
}
