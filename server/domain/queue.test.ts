import { describe, expect, it } from 'vitest'
import {
  forecastScheduled,
  isLate,
  queueInfoFor,
  quoteNewOrder,
  remainingPrepSeconds,
  sortQueue,
  type QueueEntry,
  type ScheduledEntry,
} from './queue'

const T0 = Date.UTC(2026, 10, 7, 9, 0, 0)
const sec = (s: number) => s * 1000

function entry(id: number, over: Partial<QueueEntry> = {}): QueueEntry {
  return { id, status: 'queued', queueAtMs: T0, startedAtMs: null, prepSeconds: 120, ...over }
}

describe('queue ordering', () => {
  it('orders by the time each order took its place', () => {
    const queue = [
      entry(3, { queueAtMs: T0 + sec(30) }),
      entry(1, { queueAtMs: T0 }),
      entry(2, { queueAtMs: T0 + sec(10) }),
    ]
    expect(sortQueue(queue).map((e) => e.id)).toEqual([1, 2, 3])
  })

  it('breaks ties by order id so the result is stable', () => {
    const queue = [entry(7), entry(5), entry(6)]
    expect(sortQueue(queue).map((e) => e.id)).toEqual([5, 6, 7])
  })

  it('does not mutate the input', () => {
    const queue = [entry(2, { queueAtMs: T0 + 1 }), entry(1)]
    sortQueue(queue)
    expect(queue.map((e) => e.id)).toEqual([2, 1])
  })

  it('puts a cash order behind card orders that were confirmed before payment was accepted', () => {
    const cash = entry(1, { queueAtMs: T0 + sec(60) })
    const card = entry(2, { queueAtMs: T0 + sec(20) })
    expect(sortQueue([cash, card]).map((e) => e.id)).toEqual([2, 1])
  })

  it('slots a pre-order between the orders confirmed before and after its due-to-start time', () => {
    const before = entry(1, { queueAtMs: T0 + sec(100) })
    const after = entry(3, { queueAtMs: T0 + sec(500) })
    const preorder = entry(2, { queueAtMs: T0 + sec(300) }) // due to start 300s in
    expect(sortQueue([after, preorder, before]).map((e) => e.id)).toEqual([1, 2, 3])
  })
})

describe('estimated time', () => {
  it('is just the order own prep time when nobody is ahead', () => {
    const me = entry(1, { prepSeconds: 150 })
    expect(queueInfoFor(me, [me], 2, T0)).toEqual({ ahead: 0, etaSeconds: 150 })
  })

  it('adds prep time of orders ahead, divided by the number of baristas', () => {
    const a = entry(1, { queueAtMs: T0, prepSeconds: 120 })
    const b = entry(2, { queueAtMs: T0 + sec(5), prepSeconds: 240 })
    const me = entry(3, { queueAtMs: T0 + sec(10), prepSeconds: 100 })
    const queue = [a, b, me]
    expect(queueInfoFor(me, queue, 2, T0 + sec(10))).toEqual({ ahead: 2, etaSeconds: 280 })
    expect(queueInfoFor(me, queue, 1, T0 + sec(10))).toEqual({ ahead: 2, etaSeconds: 460 })
  })

  it('ignores orders behind this one', () => {
    const me = entry(1, { queueAtMs: T0, prepSeconds: 100 })
    const later = entry(2, { queueAtMs: T0 + sec(30), prepSeconds: 600 })
    expect(queueInfoFor(me, [me, later], 1, T0)).toEqual({ ahead: 0, etaSeconds: 100 })
  })

  it('counts an order being made as ahead, even if it took its place later', () => {
    const me = entry(1, { queueAtMs: T0, prepSeconds: 100 })
    const started = entry(2, { status: 'preparing', queueAtMs: T0 + sec(30), startedAtMs: T0 + sec(40), prepSeconds: 60 })
    expect(queueInfoFor(me, [me, started], 1, T0 + sec(40))).toEqual({ ahead: 1, etaSeconds: 160 })
  })

  it('counts down the time left on orders already being made', () => {
    const started = entry(1, { status: 'preparing', startedAtMs: T0, prepSeconds: 120 })
    expect(remainingPrepSeconds(started, T0 + sec(30))).toBe(90)
    expect(remainingPrepSeconds(started, T0 + sec(500))).toBe(0)
    const me = entry(2, { queueAtMs: T0 + sec(5), prepSeconds: 100 })
    expect(queueInfoFor(me, [started, me], 1, T0 + sec(30))).toEqual({ ahead: 1, etaSeconds: 190 })
  })

  it('gives an order that is being made only its own remaining time, with nothing ahead', () => {
    const other = entry(1, { status: 'preparing', startedAtMs: T0, prepSeconds: 300 })
    const me = entry(2, { status: 'preparing', startedAtMs: T0 + sec(10), prepSeconds: 120 })
    expect(queueInfoFor(me, [other, me], 2, T0 + sec(40))).toEqual({ ahead: 0, etaSeconds: 90 })
  })

  it('treats zero or missing baristas as one so it never divides by zero', () => {
    const a = entry(1, { prepSeconds: 100 })
    const me = entry(2, { queueAtMs: T0 + 1, prepSeconds: 50 })
    expect(queueInfoFor(me, [a, me], 0, T0).etaSeconds).toBe(150)
    expect(queueInfoFor(me, [a, me], Number.NaN, T0).etaSeconds).toBe(150)
  })

  it('quotes a new order behind everything currently in the queue', () => {
    const a = entry(1, { prepSeconds: 120 })
    const b = entry(2, { status: 'preparing', startedAtMs: T0, prepSeconds: 60, queueAtMs: T0 })
    expect(quoteNewOrder(90, [a, b], 2, T0)).toEqual({ ahead: 2, etaSeconds: 180 })
    expect(quoteNewOrder(90, [], 2, T0)).toEqual({ ahead: 0, etaSeconds: 90 })
  })
})

describe('pre-order forecast', () => {
  const pre = (id: number, minutesAhead: number, prep = 120): ScheduledEntry => ({
    id,
    pickupAtMs: T0 + minutesAhead * 60_000,
    dueAtMs: T0 + minutesAhead * 60_000 - prep * 1000,
    prepSeconds: prep,
  })

  it('is ready exactly at pickup when the shop is quiet', () => {
    const f = forecastScheduled(pre(1, 30), [], [], 2, T0)
    expect(f.readyAtMs).toBe(T0 + 30 * 60_000)
    expect(f.lateBySeconds).toBe(0)
    expect(f.ahead).toBe(0)
  })

  it('stays on time when the queue clears before it is due', () => {
    const queue = [entry(9, { prepSeconds: 240 }), entry(10, { prepSeconds: 240 })]
    const f = forecastScheduled(pre(1, 30), queue, [], 2, T0)
    expect(f.lateBySeconds).toBe(0)
    expect(f.ahead).toBe(2)
  })

  it('slips past pickup when the queue is long and the pickup is soon', () => {
    // One barista, 20 minutes of work already queued, pickup in 10 minutes.
    const queue = [entry(9, { prepSeconds: 600 }), entry(10, { prepSeconds: 600 })]
    const f = forecastScheduled(pre(1, 10), queue, [], 1, T0)
    expect(f.readyAtMs).toBe(T0 + 20 * 60_000 + 120_000)
    expect(f.lateBySeconds).toBe(12 * 60)
  })

  it('counts pre-orders due earlier, but not later ones', () => {
    const mine = pre(2, 30)
    const earlier = pre(1, 28)
    const later = pre(3, 40)
    const f = forecastScheduled(mine, [], [earlier, mine, later], 1, T0)
    expect(f.ahead).toBe(1)
    // The earlier one (pickup 28:00) is done at 28:00, exactly when mine is due to start, so mine is
    // ready at its own pickup time of 30:00 with a single barista.
    expect(f.readyAtMs).toBe(T0 + 30 * 60_000)
    expect(f.lateBySeconds).toBe(0)
    // Without the earlier one in the way, nothing changes.
    expect(forecastScheduled(mine, [], [mine, later], 1, T0).ahead).toBe(0)
  })

  it('uses a second barista to keep two pre-orders on time', () => {
    const a = pre(1, 30)
    const b = pre(2, 30)
    expect(forecastScheduled(b, [], [a, b], 2, T0).lateBySeconds).toBe(0)
    expect(forecastScheduled(b, [], [a, b], 1, T0).lateBySeconds).toBe(120)
  })
})

describe('late orders', () => {
  const lateAfter = 600
  it('flags queued and preparing orders past the threshold', () => {
    expect(isLate('queued', T0, T0 + sec(601), lateAfter)).toBe(true)
    expect(isLate('preparing', T0, T0 + sec(601), lateAfter)).toBe(true)
    expect(isLate('queued', T0, T0 + sec(600), lateAfter)).toBe(false)
  })
  it('never flags orders that are waiting on payment, scheduled, ready or collected', () => {
    for (const status of ['awaiting_payment', 'scheduled', 'ready', 'collected', 'cancelled']) {
      expect(isLate(status, T0, T0 + sec(9999), lateAfter)).toBe(false)
    }
    expect(isLate('queued', null, T0 + sec(9999), lateAfter)).toBe(false)
  })
  it('judges a pre-order by its pickup time with a short grace', () => {
    const pickup = T0 + sec(1000)
    expect(isLate('queued', T0, pickup - sec(60), lateAfter, pickup)).toBe(false)
    expect(isLate('queued', T0, pickup + sec(119), lateAfter, pickup)).toBe(false)
    expect(isLate('preparing', T0, pickup + sec(121), lateAfter, pickup)).toBe(true)
  })
})
