import type { StaffOrderView } from '@shared/types'
import { Clock, TriangleAlert } from 'lucide-react'
import { cx } from '../../lib/cx'
import { clockTime, minutesSince } from '../../lib/format'
import { Button } from '../ui/Button'
import { StatusChip } from '../ui/Chip'
import { Price } from '../ui/Price'

export type OrderPath = 'accept-payment' | 'start' | 'ready' | 'collect'

/** The one obvious action for each state. Finished and cancelled orders have none. */
function primaryAction(order: StaffOrderView): { path: OrderPath; label: string } | null {
  switch (order.status) {
    case 'awaiting_payment':
      return { path: 'accept-payment', label: 'Accept payment' }
    case 'scheduled':
      return { path: 'start', label: 'Start now' }
    case 'queued':
      return { path: 'start', label: 'Start preparing' }
    case 'preparing':
      return { path: 'ready', label: 'Mark ready' }
    case 'ready':
      return { path: 'collect', label: 'Mark collected' }
    case 'collected':
    case 'cancelled':
      return null
  }
}

function timing(order: StaffOrderView, nowMs: number): string {
  const since = (iso: string | null) => minutesSince(iso, nowMs)
  switch (order.status) {
    case 'awaiting_payment':
      return `Waiting to pay · ${since(order.createdAt)} min`
    case 'scheduled':
      return `Pickup ${clockTime(order.pickupAt)}`
    case 'queued':
      return `In queue · ${since(order.confirmedAt)} min`
    case 'preparing':
      return `Making · ${since(order.startedAt)} min`
    case 'ready':
      return `Ready · ${since(order.readyAt)} min ago`
    case 'collected':
      return `Collected ${clockTime(order.collectedAt)}`
    case 'cancelled':
      return `Cancelled ${clockTime(order.cancelledAt)}`
  }
}

interface OrderCardProps {
  order: StaffOrderView
  nowMs: number
  lateAfterSeconds: number
  /** Arrived in the last minute: lit once, and labelled in words. */
  isNew: boolean
  /** First in line to be started. */
  isNext: boolean
  pending: boolean
  onAction: (order: StaffOrderView, path: OrderPath) => void
  onCancel: (order: StaffOrderView) => void
}

/** A dashboard order: big number, who and where, what to make, how long, and one button. */
export function OrderCard({ order, nowMs, isNew, isNext, pending, onAction, onCancel }: OrderCardProps) {
  const action = primaryAction(order)
  const paid = order.paymentStatus === 'paid'
  const refunded = order.paymentStatus === 'refunded'
  const preparing = order.status === 'preparing'
  const cancelled = order.status === 'cancelled'
  const lateBy = order.pickupAt
    ? Math.max(1, Math.floor((nowMs - Date.parse(order.pickupAt)) / 60000))
    : Math.max(1, Math.floor((nowMs - Date.parse(order.confirmedAt ?? order.createdAt)) / 60000))

  return (
    <article
      aria-label={`Order ${order.number}, ${order.customerName}`}
      className={cx(
        'rounded-lg border bg-surface p-4',
        preparing ? 'border-accent shadow-band' : 'border-line',
        isNew && 'animate-attention',
        (order.status === 'collected' || cancelled) && 'opacity-80',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-display-lg font-bold leading-none tnum">#{order.number}</h3>
        <div className="flex flex-wrap justify-end gap-1.5">
          {isNew && <StatusChip tone="accent">New</StatusChip>}
          {isNext && <StatusChip tone="accent">Next up</StatusChip>}
          {preparing && <StatusChip tone="accent">Preparing</StatusChip>}
          {order.pickupAt && order.status !== 'scheduled' && <StatusChip tone="neutral">Pre-order</StatusChip>}
          {cancelled ? (
            <StatusChip tone="danger">{refunded ? 'Cancelled · refunded' : 'Cancelled'}</StatusChip>
          ) : (
            <StatusChip tone={paid ? 'success' : 'warning'}>
              {paid ? `Paid · ${order.paymentMethod === 'card' ? 'Card' : 'Cash'}` : 'Not paid'}
            </StatusChip>
          )}
        </div>
      </div>

      <p className="mt-3 text-title font-semibold leading-snug text-ink">
        {order.customerName}
        <span className="font-normal text-muted">
          {' · '}
          {order.fulfilment === 'dinein' ? `Dine-in, table ${order.tableNumber}` : 'Take-away'}
        </span>
      </p>

      <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-body-sm text-muted tnum">
        <Clock size={15} strokeWidth={1.75} aria-hidden="true" />
        {timing(order, nowMs)}
        {order.status === 'queued' && order.queue.etaSeconds != null && (
          <span> · est. {Math.max(1, Math.round(order.queue.etaSeconds / 60))} min</span>
        )}
      </p>

      {order.status === 'scheduled' && order.dueAt && (
        <p className="mt-1 text-body-sm font-semibold text-ink tnum">
          Due to start {clockTime(order.dueAt)}
          <span className="font-normal text-muted"> · {dueIn(order.dueAt, nowMs)}</span>
        </p>
      )}
      {order.pickupAt && order.status === 'awaiting_payment' && (
        <p className="mt-1 text-body-sm font-semibold text-ink tnum">Pickup {clockTime(order.pickupAt)}</p>
      )}

      {order.late && (
        <p className="mt-2 flex items-center gap-1.5 text-body-sm font-semibold text-danger">
          <TriangleAlert size={16} strokeWidth={1.75} aria-hidden="true" />
          Late · {lateBy} min over
        </p>
      )}
      {cancelled && order.cancelReason && <p className="mt-2 text-body-sm text-muted">Reason: {order.cancelReason}</p>}

      <ul className="mt-4 divide-y divide-line border-y border-line">
        {order.lines.map((line) => (
          <li key={line.id} className="py-2.5">
            <p className="text-title font-semibold leading-snug text-ink">
              <span className="tnum">{line.quantity} ×</span> {line.name}
            </p>
            {line.modifiers.length > 0 && <p className="text-body text-muted">{line.modifiers.join(' · ')}</p>}
            {line.note && (
              <p className="mt-0.5 text-body font-semibold text-ink">
                <span className="font-normal text-muted">Note: </span>
                {line.note}
              </p>
            )}
          </li>
        ))}
      </ul>

      {order.status === 'awaiting_payment' && (
        <p className="mt-4 flex items-baseline justify-between gap-3">
          <span className="text-title font-semibold">Take at the counter</span>
          <Price fils={order.totalFils} size="lg" />
        </p>
      )}

      {action && (
        <Button size="xl" block busy={pending} className="mt-4 min-h-14" onClick={() => onAction(order, action.path)}>
          {action.label}
        </Button>
      )}

      {order.status !== 'collected' && !cancelled && (
        <button
          type="button"
          onClick={() => onCancel(order)}
          className="mt-2 min-h-11 w-full rounded-md text-body-sm font-semibold text-muted underline-offset-4 transition-colors hover:text-danger hover:underline"
        >
          Cancel order
        </button>
      )}

      {order.receiptId && <p className="mt-3 text-body-sm text-muted tnum">POS receipt {order.receiptId}</p>}
    </article>
  )
}

function dueIn(dueAt: string, nowMs: number): string {
  const minutes = Math.round((Date.parse(dueAt) - nowMs) / 60000)
  if (minutes >= 60) {
    const rest = minutes % 60
    return `in ${Math.floor(minutes / 60)} h${rest ? ` ${rest} min` : ''}`
  }
  if (minutes > 1) return `in ${minutes} min`
  if (minutes >= -1) return 'about now'
  return `${Math.abs(minutes)} min ago`
}
