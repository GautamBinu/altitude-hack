import { minutesUntil, statusCopy, type StatusCopy } from '@shared/orderFlow'
import type { OrderView } from '@shared/types'
import { useNow } from '../lib/clock'

/** The plain-language status for an order, with the minutes left ticking down on server time. */
export function useOrderCopy(order: OrderView): StatusCopy & { minutesLeft: number | null } {
  const now = useNow(15_000)
  const minutesLeft = order.queue.estimatedReadyAt ? minutesUntil(Date.parse(order.queue.estimatedReadyAt), now) : null
  return { ...statusCopy(order.status, order.queue.ahead, minutesLeft), minutesLeft }
}
