import { STATUS_LABEL } from '@shared/orderFlow'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { OrderStatusPanel } from '../../components/orders/OrderStatusPanel'
import { ReorderButton } from '../../components/orders/ReorderButton'
import { SignInOptions } from '../../components/SignInOptions'
import { LoadingLine } from '../../components/ui/Art'
import { LinkButton } from '../../components/ui/Button'
import { Price } from '../../components/ui/Price'
import { EmptyState } from '../../components/ui/States'
import { shortDateTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'

export function OrdersPage() {
  useDocumentTitle('Orders')
  const { user } = useSession()
  const { orders, loaded } = useOrders()
  const active = orders.filter((o) => o.status !== 'collected' && o.status !== 'cancelled')
  const earlier = orders.filter((o) => o.status === 'collected' || o.status === 'cancelled')

  if (!user) {
    return (
      <div className="max-w-md">
        <h1 className="text-display-lg font-bold">Orders</h1>
        <p className="mt-2 mb-6 text-body text-muted">Sign in to see your orders and follow them live.</p>
        <SignInOptions />
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-display-lg font-bold">Orders</h1>

      {!loaded ? (
        <div role="status" className="mt-6">
          <LoadingLine label="Loading your orders" />
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          className="mt-6"
          title="No orders yet"
          action={<LinkButton to="/menu">Browse the menu</LinkButton>}
        >
          Your first one will show up here, and you can follow it from the counter to your hand.
        </EmptyState>
      ) : (
        <>
          {active.length > 0 && (
            <section aria-labelledby="active-heading" className="mt-6 grid gap-4">
              <h2 id="active-heading" className="text-headline font-semibold">
                In progress
              </h2>
              {active.map((order) => (
                <OrderStatusPanel key={order.id} order={order} linked />
              ))}
            </section>
          )}

          {earlier.length > 0 && (
            <section aria-labelledby="earlier-heading" className="mt-10">
              <h2 id="earlier-heading" className="mb-2 text-headline font-semibold">
                Earlier
              </h2>
              <ul className="divide-y divide-line border-y border-line">
                {earlier.map((order) => (
                  <li key={order.id} className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
                    <Link
                      to={`/orders/${order.id}`}
                      className="flex min-h-16 min-w-0 flex-1 items-center gap-4 py-3 transition-colors hover:bg-surface"
                    >
                      <span className="w-16 shrink-0 font-display text-headline font-semibold tnum sm:w-20">#{order.number}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-body font-semibold text-ink">
                          {order.lines.map((l) => `${l.quantity} × ${l.name}`).join(', ')}
                        </span>
                        <span className="block text-body-sm text-muted">
                          {shortDateTime(order.createdAt)} · {STATUS_LABEL[order.status]}
                        </span>
                      </span>
                      <span className="hidden shrink-0 sm:block">
                        <Price fils={order.totalFils} size="sm" />
                      </span>
                      <ChevronRight size={18} strokeWidth={1.75} className="shrink-0 text-muted" aria-hidden="true" />
                    </Link>
                    {(order.status === 'collected' || order.status === 'cancelled') && (
                      <div className="pb-3 pl-20 sm:p-0">
                        <ReorderButton lines={order.lines} />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  )
}
