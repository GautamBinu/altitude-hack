import { minutesUntil, statusCopy, type StatusCopy } from '@shared/orderFlow'
import type { OrderView } from '@shared/types'
import { useNow } from '../lib/clock'

/** The plain-language status for an order, with the minutes left ticking down on server time. */
export function useOrderCopy(order: OrderView): StatusCopy & { minutesLeft: number | null } {
  const now = useNow(15_000)
  const readyMs = order.queue.estimatedReadyAt ? Date.parse(order.queue.estimatedReadyAt) : null
  const minutesLeft = readyMs != null ? minutesUntil(readyMs, now) : null
  const pickupMs = order.pickupAt ? Date.parse(order.pickupAt) : null
  // A pre-order whose forecast has slipped more than a minute past pickup is running behind.
  const runningLate = pickupMs != null && readyMs != null && readyMs - pickupMs > 60_000
  return {
    ...statusCopy({
      status: order.status,
      ahead: order.queue.ahead,
      minutesLeft,
      pickupAt: order.pickupAt,
      dueAt: order.dueAt,
      cancelReason: order.cancelReason,
      refunded: order.refunded,
      runningLate,
    }),
    minutesLeft,
  }
}
