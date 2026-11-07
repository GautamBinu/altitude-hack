import { describe, expect, it } from 'vitest'
import {
  isLate,
  queueInfoFor,
  quoteNewOrder,
  remainingPrepSeconds,
  sortQueue,
  type QueueEntry,
} from './queue'

const T0 = Date.UTC(2026, 10, 7, 9, 0, 0)
const sec = (s: number) => s * 1000

function entry(id: number, over: Partial<QueueEntry> = {}): QueueEntry {
  return { id, status: 'queued', confirmedAtMs: T0, startedAtMs: null, prepSeconds: 120, ...over }
}

describe('queue ordering', () => {
  it('orders by the time each order was confirmed', () => {
    const queue = [
      entry(3, { confirmedAtMs: T0 + sec(30) }),
      entry(1, { confirmedAtMs: T0 }),
      entry(2, { confirmedAtMs: T0 + sec(10) }),
    ]
    expect(sortQueue(queue).map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('breaks ties by order id so the result is stable', () => {
    const queue = [entry(7), entry(5), entry(6)]
    expect(sortQueue(queue).map((e) => e.id)).toEqual([5, 6, 7])
  })

  it('does not mutate the input', () => {
    const queue = [entry(2, { confirmedAtMs: T0 + 1 }), entry(1)]
    sortQueue(queue)
    expect(queue.map((e) => e.id)).toEqual([2, 1])
  })

  it('puts a cash order behind card orders that were confirmed before payment was accepted', () => {
    // Cash order placed first but only confirmed (payment accepted) after the card order.
    const cash = entry(1, { confirmedAtMs: T0 + sec(60) })
    const card = entry(2, { confirmedAtMs: T0 + sec(20) })
    expect(sortQueue([cash, card]).map((e) => e.id)).toEqual([2, 1])
  })
})

describe('estimated time', () => {
  it('is just the order own prep time when nobody is ahead', () => {
    const me = entry(1, { prepSeconds: 150 })
    expect(queueInfoFor(me, [me], 2, T0)).toEqual({ ahead: 0, etaSeconds: 150 })
  })

  it('adds prep time of orders ahead, divided by the number of baristas', () => {
    const a = entry(1, { confirmedAtMs: T0, prepSeconds: 120 })
    const b = entry(2, { confirmedAtMs: T0 + sec(5), prepSeconds: 240 })
    const me = entry(3, { confirmedAtMs: T0 + sec(10), prepSeconds: 100 })
    const queue = [a, b, me]
    // (120 + 240) / 2 baristas + 100 = 280
    expect(queueInfoFor(me, queue, 2, T0 + sec(10))).toEqual({ ahead: 2, etaSeconds: 280 })
    // One barista: 360 + 100
    expect(queueInfoFor(me, queue, 1, T0 + sec(10))).toEqual({ ahead: 2, etaSeconds: 460 })
  })

  it('ignores orders behind this one', () => {
    const me = entry(1, { confirmedAtMs: T0, prepSeconds: 100 })
    const later = entry(2, { confirmedAtMs: T0 + sec(30), prepSeconds: 600 })
    expect(queueInfoFor(me, [me, later], 1, T0)).toEqual({ ahead: 0, etaSeconds: 100 })
  })

  it('counts an order being made as ahead, even if it was confirmed later', () => {
    const me = entry(1, { confirmedAtMs: T0, prepSeconds: 100 })
    const started = entry(2, { status: 'preparing', confirmedAtMs: T0 + sec(30), startedAtMs: T0 + sec(40), prepSeconds: 60 })
    expect(queueInfoFor(me, [me, started], 1, T0 + sec(40))).toEqual({ ahead: 1, etaSeconds: 160 })
  })

  it('counts down the time left on orders already being made', () => {
    const started = entry(1, { status: 'preparing', startedAtMs: T0, prepSeconds: 120 })
    expect(remainingPrepSeconds(started, T0 + sec(30))).toBe(90)
    expect(remainingPrepSeconds(started, T0 + sec(500))).toBe(0)
    const me = entry(2, { confirmedAtMs: T0 + sec(5), prepSeconds: 100 })
    expect(queueInfoFor(me, [started, me], 1, T0 + sec(30))).toEqual({ ahead: 1, etaSeconds: 190 })
  })

  it('gives an order that is being made only its own remaining time, with nothing ahead', () => {
    const other = entry(1, { status: 'preparing', startedAtMs: T0, prepSeconds: 300 })
    const me = entry(2, { status: 'preparing', startedAtMs: T0 + sec(10), prepSeconds: 120 })
    expect(queueInfoFor(me, [other, me], 2, T0 + sec(40))).toEqual({ ahead: 0, etaSeconds: 90 })
  })

  it('treats zero or missing baristas as one so it never divides by zero', () => {
    const a = entry(1, { prepSeconds: 100 })
    const me = entry(2, { confirmedAtMs: T0 + 1, prepSeconds: 50 })
    expect(queueInfoFor(me, [a, me], 0, T0).etaSeconds).toBe(150)
    expect(queueInfoFor(me, [a, me], Number.NaN, T0).etaSeconds).toBe(150)
  })

  it('quotes a new order behind everything currently in the queue', () => {
    const a = entry(1, { prepSeconds: 120 })
    const b = entry(2, { status: 'preparing', startedAtMs: T0, prepSeconds: 60, confirmedAtMs: T0 })
    // Both ahead: (120 + 60 remaining at T0) / 2 + 90 = 180
    expect(quoteNewOrder(90, [a, b], 2, T0)).toEqual({ ahead: 2, etaSeconds: 180 })
    expect(quoteNewOrder(90, [], 2, T0)).toEqual({ ahead: 0, etaSeconds: 90 })
  })
})

describe('late orders', () => {
  const lateAfter = 600
  it('flags queued and preparing orders past the threshold', () => {
    expect(isLate('queued', T0, T0 + sec(601), lateAfter)).toBe(true)
    expect(isLate('preparing', T0, T0 + sec(601), lateAfter)).toBe(true)
    expect(isLate('queued', T0, T0 + sec(600), lateAfter)).toBe(false)
  })
  it('never flags orders that are waiting on payment, ready or collected', () => {
    for (const status of ['awaiting_payment', 'ready', 'collected']) {
      expect(isLate(status, T0, T0 + sec(9999), lateAfter)).toBe(false)
    }
    expect(isLate('queued', null, T0 + sec(9999), lateAfter)).toBe(false)
  })
})
