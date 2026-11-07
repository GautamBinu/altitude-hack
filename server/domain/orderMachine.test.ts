import { describe, expect, it } from 'vitest'
import { applyAction, initialState, type OrderState } from './orderMachine'

const cash = initialState('cash')
const card = initialState('card')

function ok(state: OrderState, action: Parameters<typeof applyAction>[1]): OrderState {
  const result = applyAction(state, action)
  if (!result.ok) throw new Error(`expected ${action} to succeed: ${result.message}`)
  return result.next
}

describe('initial state', () => {
  it('puts a card order straight into the queue, paid', () => {
    expect(card).toEqual({ status: 'queued', paymentStatus: 'paid' })
  })
  it('holds a cash order at the payment step, unpaid', () => {
    expect(cash).toEqual({ status: 'awaiting_payment', paymentStatus: 'unpaid' })
  })
})

describe('cash payment gating', () => {
  it('cannot be started, made ready or collected before payment is accepted', () => {
    for (const action of ['start', 'ready'] as const) {
      const result = applyAction(cash, action)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.code).toBe('not_paid')
    }
    expect(applyAction(cash, 'collect').ok).toBe(false)
  })

  it('moves into the queue once payment is accepted', () => {
    expect(ok(cash, 'accept_payment')).toEqual({ status: 'queued', paymentStatus: 'paid' })
  })

  it('cannot have payment accepted twice', () => {
    const paid = ok(cash, 'accept_payment')
    const again = applyAction(paid, 'accept_payment')
    expect(again.ok).toBe(false)
    if (!again.ok) expect(again.code).toBe('already_paid')
  })

  it('cannot have payment accepted on a card order', () => {
    expect(applyAction(card, 'accept_payment').ok).toBe(false)
  })
})

describe('the happy path', () => {
  it('runs a card order through start, ready and collected', () => {
    let s = card
    s = ok(s, 'start')
    expect(s.status).toBe('preparing')
    s = ok(s, 'ready')
    expect(s.status).toBe('ready')
    s = ok(s, 'collect')
    expect(s.status).toBe('collected')
  })

  it('runs a cash order the same way after payment is accepted', () => {
    let s = ok(cash, 'accept_payment')
    s = ok(s, 'start')
    s = ok(s, 'ready')
    s = ok(s, 'collect')
    expect(s).toEqual({ status: 'collected', paymentStatus: 'paid' })
  })
})

describe('invalid moves are rejected', () => {
  it('does not skip steps', () => {
    expect(applyAction(card, 'ready').ok).toBe(false)
    expect(applyAction(card, 'collect').ok).toBe(false)
    expect(applyAction(ok(card, 'start'), 'collect').ok).toBe(false)
  })

  it('does not go backwards or repeat', () => {
    const preparing = ok(card, 'start')
    expect(applyAction(preparing, 'start').ok).toBe(false)
    const collected = ok(ok(preparing, 'ready'), 'collect')
    for (const action of ['start', 'ready', 'collect', 'accept_payment'] as const) {
      expect(applyAction(collected, action).ok).toBe(false)
    }
  })

  it('gives a message a barista can act on', () => {
    const result = applyAction(cash, 'start')
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toMatch(/Accept payment first/)
  })
})
