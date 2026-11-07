import type { OrderStatus } from './types'

/** The four steps customers see. Collected is the finished state after Ready. */
export const TRACKER_STEPS = ['Placed', 'Payment', 'Preparing', 'Ready'] as const

/**
 * Which step the order is on, 1 to 4, or 5 once collected (everything complete).
 * Cash orders wait on step 2 until staff accept payment. Queued and in-progress orders both sit on
 * step 3: the headline tells them apart ("Two ahead of you" versus "Being made now").
 */
export function stepNumber(status: OrderStatus): 1 | 2 | 3 | 4 | 5 {
  switch (status) {
    case 'awaiting_payment':
      return 2
    case 'queued':
    case 'preparing':
      return 3
    case 'ready':
      return 4
    case 'collected':
      return 5
  }
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten']

export function aheadPhrase(ahead: number): string {
  if (ahead <= 0) return "You're next"
  const word = ahead < NUMBER_WORDS.length ? NUMBER_WORDS[ahead] : String(ahead)
  return `${word} ahead of you`
}

/** "About a minute", "About 6 minutes". */
export function minutesPhrase(minutes: number): string {
  if (minutes <= 1) return 'About a minute'
  return `About ${minutes} minutes`
}

/** Whole minutes remaining, rounded up, never below zero. */
export function minutesUntil(targetMs: number, nowMs: number): number {
  return Math.max(0, Math.ceil((targetMs - nowMs) / 60000))
}

export interface StatusCopy {
  headline: string
  detail: string | null
}

/** The plain-language answer to "where is my order and how long". */
export function statusCopy(
  status: OrderStatus,
  ahead: number | null,
  minutesLeft: number | null,
): StatusCopy {
  switch (status) {
    case 'awaiting_payment':
      return { headline: 'Pay at the counter to start your order.', detail: null }
    case 'queued':
      return {
        headline: `${aheadPhrase(ahead ?? 0)}.`,
        detail: minutesLeft == null ? null : `${minutesPhrase(minutesLeft)}.`,
      }
    case 'preparing':
      return {
        headline: 'Being made now.',
        detail: minutesLeft == null ? null : minutesLeft <= 0 ? 'Almost ready.' : `${minutesPhrase(minutesLeft)}.`,
      }
    case 'ready':
      return { headline: 'Ready at the counter.', detail: 'Give your order number.' }
    case 'collected':
      return { headline: 'Collected.', detail: 'Thanks for coming by.' }
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  queued: 'In the queue',
  preparing: 'Preparing',
  ready: 'Ready',
  collected: 'Collected',
}
