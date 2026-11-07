import { STATUS_LABEL } from '../../shared/orderFlow'
import type { OrderAction, OrderStatus, PaymentMethod, PaymentStatus } from '../../shared/types'

export interface OrderState {
  status: OrderStatus
  paymentStatus: PaymentStatus
}

export type TransitionResult =
  | { ok: true; next: OrderState }
  | { ok: false; code: 'not_paid' | 'already_paid' | 'wrong_state'; message: string }

/**
 * The state a new order starts in.
 * Card: payment completes instantly, so the order goes straight into the queue, or onto the
 * Scheduled lane when it is a pre-order that is not due yet.
 * Cash: the order waits at the payment step until staff accept payment.
 */
export function initialState(method: PaymentMethod, isPreorder = false): OrderState {
  return method === 'card'
    ? { status: isPreorder ? 'scheduled' : 'queued', paymentStatus: 'paid' }
    : { status: 'awaiting_payment', paymentStatus: 'unpaid' }
}

const VERB: Record<OrderAction, string> = {
  accept_payment: 'accept payment for',
  start: 'start',
  ready: 'mark ready',
  collect: 'mark collected',
}

interface Context {
  /** For accept_payment on a pre-order: true when it is not due to start yet, so it goes to Scheduled. */
  dueInFuture?: boolean
}

const NOT_PAID = {
  ok: false,
  code: 'not_paid',
  message: "This order hasn't been paid yet. Accept payment first.",
} as const

/** The only way an order moves forward. The server rejects anything else. */
export function applyAction(state: OrderState, action: OrderAction, context: Context = {}): TransitionResult {
  const wrong = (): TransitionResult => ({
    ok: false,
    code: 'wrong_state',
    message: `Can't ${VERB[action]} an order that is ${STATUS_LABEL[state.status].toLowerCase()}.`,
  })

  switch (action) {
    case 'accept_payment':
      if (state.paymentStatus === 'paid') {
        return { ok: false, code: 'already_paid', message: 'This order is already paid.' }
      }
      if (state.status !== 'awaiting_payment') return wrong()
      return { ok: true, next: { status: context.dueInFuture ? 'scheduled' : 'queued', paymentStatus: 'paid' } }

    case 'start':
      // The cash gate: nothing is made until the money is taken.
      if (state.status === 'awaiting_payment' || state.paymentStatus !== 'paid') return NOT_PAID
      // A barista can start a pre-order early if they have a gap.
      if (state.status !== 'queued' && state.status !== 'scheduled') return wrong()
      return { ok: true, next: { status: 'preparing', paymentStatus: state.paymentStatus } }

    case 'ready':
      if (state.status === 'awaiting_payment' || state.paymentStatus !== 'paid') return NOT_PAID
      if (state.status !== 'preparing') return wrong()
      return { ok: true, next: { status: 'ready', paymentStatus: state.paymentStatus } }

    case 'collect':
      if (state.status !== 'ready') return wrong()
      return { ok: true, next: { status: 'collected', paymentStatus: state.paymentStatus } }
  }
}

export type CancelResult =
  | { ok: true; next: OrderState; refund: boolean }
  | { ok: false; message: string }

const CANCELLABLE: OrderStatus[] = ['awaiting_payment', 'scheduled', 'queued', 'preparing', 'ready']

/**
 * Cancelling is allowed until the order is collected. A paid card order can be refunded; the caller
 * decides whether to (the dashboard offers it as a tick box that defaults to on).
 */
export function applyCancel(state: OrderState, refund: boolean, method: PaymentMethod): CancelResult {
  if (!CANCELLABLE.includes(state.status)) {
    return { ok: false, message: `Can't cancel an order that is ${STATUS_LABEL[state.status].toLowerCase()}.` }
  }
  const refunded = refund && state.paymentStatus === 'paid' && method === 'card'
  return {
    ok: true,
    refund: refunded,
    next: { status: 'cancelled', paymentStatus: refunded ? 'refunded' : state.paymentStatus },
  }
}
