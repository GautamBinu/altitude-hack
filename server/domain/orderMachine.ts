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
 * Card: payment completes instantly, so the order goes straight into the queue.
 * Cash: the order waits at the payment step until staff accept payment.
 */
export function initialState(method: PaymentMethod): OrderState {
  return method === 'card'
    ? { status: 'queued', paymentStatus: 'paid' }
    : { status: 'awaiting_payment', paymentStatus: 'unpaid' }
}

const VERB: Record<OrderAction, string> = {
  accept_payment: 'accept payment for',
  start: 'start',
  ready: 'mark ready',
  collect: 'mark collected',
}

/** The only way an order moves forward. The server rejects anything else. */
export function applyAction(state: OrderState, action: OrderAction): TransitionResult {
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
      return { ok: true, next: { status: 'queued', paymentStatus: 'paid' } }

    case 'start':
      // The cash gate: nothing is made until the money is taken.
      if (state.status === 'awaiting_payment' || state.paymentStatus !== 'paid') {
        return { ok: false, code: 'not_paid', message: "This order hasn't been paid yet. Accept payment first." }
      }
      if (state.status !== 'queued') return wrong()
      return { ok: true, next: { status: 'preparing', paymentStatus: state.paymentStatus } }

    case 'ready':
      if (state.status === 'awaiting_payment' || state.paymentStatus !== 'paid') {
        return { ok: false, code: 'not_paid', message: "This order hasn't been paid yet. Accept payment first." }
      }
      if (state.status !== 'preparing') return wrong()
      return { ok: true, next: { status: 'ready', paymentStatus: state.paymentStatus } }

    case 'collect':
      if (state.status !== 'ready') return wrong()
      return { ok: true, next: { status: 'collected', paymentStatus: state.paymentStatus } }
  }
}
