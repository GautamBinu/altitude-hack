import { formatAedNumber } from '@shared/money'
import type { OrderView } from '@shared/types'
import { WifiOff } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'
import { Logo } from '../../components/Logo'
import { OrderLines } from '../../components/orders/OrderLines'
import { OrderStatusPanel } from '../../components/orders/OrderStatusPanel'
import { ReorderButton } from '../../components/orders/ReorderButton'
import { SignInOptions } from '../../components/SignInOptions'
import { LoadingLine } from '../../components/ui/Art'
import { LinkButton } from '../../components/ui/Button'
import { StatusChip } from '../../components/ui/Chip'
import { Price } from '../../components/ui/Price'
import { ErrorState } from '../../components/ui/States'
import { api, ApiError } from '../../lib/api'
import { syncServerClock } from '../../lib/clock'
import { clockTime } from '../../lib/format'
import { useDocumentTitle } from '../../lib/useDocumentTitle'
import { useOrders } from '../../state/orders'
import { useSession } from '../../state/session'

/** An order that is not among the recent ones (for example a link opened later). */
function useOlderOrder(id: number, enabled: boolean) {
  const [state, setState] = useState<{ order: OrderView | null; failed: ApiError | null; done: boolean }>({
    order: null,
    failed: null,
    done: false,
  })
  useEffect(() => {
    if (!enabled) return
    let cancelled = false
    api<{ serverNow: string; order: OrderView }>(`/orders/${id}`)
      .then((r) => {
        if (cancelled) return
        syncServerClock(r.serverNow)
        setState({ order: r.order, failed: null, done: true })
      })
      .catch((e: unknown) => {
        if (!cancelled) setState({ order: null, failed: e instanceof ApiError ? e : null, done: true })
      })
    return () => {
      cancelled = true
    }
  }, [id, enabled])
  return state
}

export function OrderPage() {
  const params = useParams()
  const id = Number(params.id)
  const location = useLocation()
  const justPlaced = (location.state as { justPlaced?: boolean } | null)?.justPlaced === true
  const { user } = useSession()
  const { orders, loaded, live, lastUpdateAt } = useOrders()

  const fromList = orders.find((o) => o.id === id) ?? null
  const needsFetch = !!user && loaded && !fromList
  const older = useOlderOrder(id, needsFetch)
  const order = fromList ?? older.order

  useDocumentTitle(order ? (order.status === 'ready' ? `Order #${order.number} is ready` : `Order #${order.number}`) : 'Order')

  if (!user) {
    return (
      <div className="max-w-md">
        <h1 className="text-display-lg font-bold">Your order</h1>
        <p className="mt-2 mb-6 text-body text-muted">Sign in to see where your order is.</p>
        <SignInOptions />
      </div>
    )
  }

  if (!loaded || (needsFetch && !older.done)) {
    return (
      <div role="status" className="max-w-136">
        <LoadingLine label="Loading your order" />
      </div>
    )
  }

  if (!order) {
    return (
      <ErrorState
        title="We couldn't find that order"
        message={older.failed?.isOffline ? older.failed.message : 'It may belong to a different account, or it may be too old to show here.'}
        offline={older.failed?.isOffline}
        className="max-w-xl"
      />
    )
  }

  const active = order.status !== 'collected'
  const paid = order.paymentStatus === 'paid'

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-start lg:gap-12">
      <div className="min-w-0">
        {justPlaced && (
          <div className="mb-6 flex items-center gap-5 rounded-lg bg-navy px-5 py-4">
            <Logo variant="full" height={72} tone="cream" />
            <p className="text-headline font-semibold text-cream">Order placed.</p>
          </div>
        )}

        {active && !live && (
          <p role="status" className="mb-4 flex items-start gap-2 rounded-md border border-line bg-surface px-4 py-3 text-body-sm text-muted">
            <WifiOff size={16} strokeWidth={1.75} className="mt-0.5 shrink-0" aria-hidden="true" />
            <span>
              Reconnecting. This shows the last update{lastUpdateAt ? ` from ${clockTime(lastUpdateAt)}` : ''}.
            </span>
          </p>
        )}

        <OrderStatusPanel order={order} headingLevel="h1" />

        {order.status === 'awaiting_payment' && (
          <p className="mt-4 text-body text-muted">
            Give the barista your order number and pay <Price fils={order.totalFils} size="sm" className="align-baseline" />.
            We'll start as soon as you do.
          </p>
        )}
        {order.status === 'ready' && <p className="mt-4 text-body text-muted">Say your order number when you reach the counter.</p>}
      </div>

      <aside className="mt-8 lg:mt-0" aria-label="Order details">
        <h2 className="mb-4 text-headline font-semibold">Your order</h2>
        <OrderLines lines={order.lines} />
        {(order.rewardFils > 0 || order.codeFils > 0 || order.passFils > 0) && (
          <dl className="mt-4 grid gap-1.5 border-t border-line pt-4 text-body-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Subtotal</dt>
              <dd className="tnum">{formatAedNumber(order.subtotalFils)} AED</dd>
            </div>
            {order.passFils > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Summit Box ({order.passUnits} {order.passUnits === 1 ? 'drink' : 'drinks'})</dt>
                <dd className="tnum">-{formatAedNumber(order.passFils)} AED</dd>
              </div>
            )}
            {order.codeFils > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Code {order.code}</dt>
                <dd className="tnum">-{formatAedNumber(order.codeFils)} AED</dd>
              </div>
            )}
            {order.rewardFils > 0 && (
              <div className="flex justify-between">
                <dt className="text-muted">Reward ({order.rewardPoints.toLocaleString('en-US')} pts)</dt>
                <dd className="tnum">-{formatAedNumber(order.rewardFils)} AED</dd>
              </div>
            )}
          </dl>
        )}
        <div className="mt-4 flex items-center justify-between border-t border-line pt-4">
          <span className="text-title font-semibold">Total</span>
          <Price fils={order.totalFils} size="lg" />
        </div>
        {order.status === 'collected' && order.pointsAwarded > 0 && (
          <p className="mt-3 text-body-sm text-muted tnum">
            You earned <span className="font-semibold text-ink">{order.pointsAwarded.toLocaleString('en-US')} points</span> on this order.
          </p>
        )}

        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-3 border-t border-line pt-4 text-body-sm">
          <dt className="text-muted">Fulfilment</dt>
          <dd className="text-right font-semibold text-ink">
            {order.fulfilment === 'dinein' ? `Dine-in, table ${order.tableNumber}` : 'Take-away'}
          </dd>
          <dt className="text-muted">Payment</dt>
          <dd className="text-right">
            <span className="mr-2 font-semibold text-ink">{order.paymentMethod === 'card' ? 'Card' : 'Pay at counter'}</span>
            <StatusChip tone={paid ? 'success' : 'warning'}>{paid ? 'Paid' : 'Not paid yet'}</StatusChip>
          </dd>
          <dt className="text-muted">Placed</dt>
          <dd className="text-right font-semibold text-ink tnum">{clockTime(order.createdAt)}</dd>
        </dl>

        <LinkButton to="/orders" variant="secondary" size="md" className="mt-6">
          All your orders
        </LinkButton>
        {!active && (
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <ReorderButton lines={order.lines} label="Order this again" variant="primary" />
            <Link to="/menu" className="text-body-sm font-semibold text-ink underline underline-offset-4">
              Back to the menu
            </Link>
          </div>
        )}
      </aside>
    </div>
  )
}
