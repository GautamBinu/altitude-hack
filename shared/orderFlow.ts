import type { OrderStatus } from './types'

/** The four steps customers see. Collected is the finished state after Ready. */
export const TRACKER_STEPS = ['Placed', 'Payment', 'Preparing', 'Ready'] as const

/**
 * Where the order is on the climb. `done` is how many stops are complete (0 to 4); `current` is the
 * stop that glows, or null when nothing is in progress right now.
 *
 * Cash orders wait on step 2 until staff accept payment. Queued and in-progress orders both sit on
 * step 3: the headline tells them apart ("Two ahead of you" versus "Being made now"). A pre-order that
 * is paid but not started yet has finished steps 1 and 2 and is simply waiting for its time.
 */
export function trackerPosition(status: OrderStatus): { done: number; current: number | null } {
  switch (status) {
    case 'awaiting_payment':
      return { done: 1, current: 1 }
    case 'scheduled':
      return { done: 2, current: null }
    case 'queued':
    case 'preparing':
      return { done: 2, current: 2 }
    case 'ready':
      return { done: 3, current: 3 }
    case 'collected':
      return { done: 4, current: null }
    case 'cancelled':
      return { done: 0, current: null }
  }
}

/** Step number out of 4 for notification text such as "Step 3 of 4: Preparing". */
export function stepNumber(status: OrderStatus): 1 | 2 | 3 | 4 | 5 {
  switch (status) {
    case 'awaiting_payment':
      return 2
    case 'scheduled':
    case 'queued':
    case 'preparing':
      return 3
    case 'ready':
      return 4
    case 'collected':
      return 5
    case 'cancelled':
      return 1
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

/** "13:30" in the viewer's own clock. */
export function clockLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
}

export interface StatusCopy {
  headline: string
  detail: string | null
}

interface CopyInput {
  status: OrderStatus
  ahead: number | null
  minutesLeft: number | null
  /** ISO pickup time for a pre-order. */
  pickupAt?: string | null
  dueAt?: string | null
  cancelReason?: string | null
  refunded?: boolean
  /** True when the estimate has slipped past the pickup time. */
  runningLate?: boolean
}

/** The plain-language answer to "where is my order and how long". */
export function statusCopy(input: CopyInput): StatusCopy {
  const { status, ahead, minutesLeft, pickupAt, dueAt } = input
  const pickup = pickupAt ? `Pickup at ${clockLabel(pickupAt)}.` : null
  switch (status) {
    case 'awaiting_payment':
      return { headline: 'Pay at the counter to start your order.', detail: pickup }
    case 'scheduled':
      return {
        headline: pickup ?? 'Scheduled.',
        detail: dueAt ? `We start making it at ${clockLabel(dueAt)}.` : null,
      }
    case 'queued': {
      const base = `${aheadPhrase(ahead ?? 0)}.`
      if (pickup && input.runningLate && minutesLeft != null) {
        return { headline: `${base} Running a little behind.`, detail: `${minutesPhrase(minutesLeft)}. ${pickup}` }
      }
      return {
        headline: base,
        detail: pickup ?? (minutesLeft == null ? null : `${minutesPhrase(minutesLeft)}.`),
      }
    }
    case 'preparing':
      return {
        headline: 'Being made now.',
        detail: pickup ?? (minutesLeft == null ? null : minutesLeft <= 0 ? 'Almost ready.' : `${minutesPhrase(minutesLeft)}.`),
      }
    case 'ready':
      return { headline: 'Ready at the counter.', detail: 'Give your order number.' }
    case 'collected':
      return { headline: 'Collected.', detail: 'Thanks for coming by.' }
    case 'cancelled':
      return {
        headline: 'This order was cancelled.',
        detail: [input.cancelReason, input.refunded ? 'Your card payment is being refunded.' : null].filter(Boolean).join(' ') || null,
      }
  }
}

export const STATUS_LABEL: Record<OrderStatus, string> = {
  awaiting_payment: 'Awaiting payment',
  scheduled: 'Scheduled',
  queued: 'In the queue',
  preparing: 'Preparing',
  ready: 'Ready',
  collected: 'Collected',
  cancelled: 'Cancelled',
}
