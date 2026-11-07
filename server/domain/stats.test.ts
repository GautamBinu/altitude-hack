import { describe, expect, it } from 'vitest'
import { csvCell, toCsv } from './csv'
import {
  categoriesOf,
  change,
  customerSplit,
  datesBetween,
  daysOf,
  hoursOf,
  itemsOf,
  kpisOf,
  leastPopular,
  queueProfile,
  slowestItems,
  splitsOf,
  windowFor,
  type StatLine,
  type StatOrder,
} from './stats'

const TZ = 'Asia/Dubai' // UTC+4, no daylight saving

/** An instant from a Dubai clock reading: at('2026-11-05', '09:30'). */
const at = (date: string, time: string): string => new Date(`${date}T${time}:00+04:00`).toISOString()

let nextId = 1
function order(over: Partial<StatOrder> & { date?: string; time?: string } = {}): StatOrder {
  const date = over.date ?? '2026-11-05'
  const created = at(date, over.time ?? '09:00')
  const { date: _d, time: _t, ...rest } = over
  const id = nextId++
  return {
    id,
    number: id,
    userId: 1,
    customerName: 'Aisha',
    businessDate: date,
    createdAt: created,
    fulfilment: 'takeaway',
    method: 'card',
    paymentStatus: 'paid',
    status: 'collected',
    totalFils: 2500,
    pickupAt: null,
    queueAt: created,
    startedAt: null,
    readyAt: null,
    wasLate: false,
    rating: null,
    pointsAwarded: 25,
    ...rest,
  }
}

const line = (orderId: number, name: string, over: Partial<StatLine> = {}): StatLine => ({
  orderId, name, kind: 'drink', categorySlug: 'espresso-bar', quantity: 1, unitPriceFils: 2500, ...over,
})

describe('which days a range covers', () => {
  const now = new Date(at('2026-11-07', '15:00'))

  it('compares today with yesterday up to the same time', () => {
    const w = windowFor('today', now, TZ)
    expect([w.from, w.to, w.prevFrom, w.prevTo]).toEqual(['2026-11-07', '2026-11-07', '2026-11-06', '2026-11-06'])
    expect(w.prevCutoffMs).toBe(now.getTime() - 86_400_000)
    expect(w.comparisonLabel).toContain('yesterday')
  })

  it('runs seven days up to and including today, against the seven before', () => {
    const w = windowFor('7d', now, TZ)
    expect([w.from, w.to]).toEqual(['2026-11-01', '2026-11-07'])
    expect([w.prevFrom, w.prevTo]).toEqual(['2026-10-25', '2026-10-31'])
    expect(datesBetween(w.from, w.to)).toHaveLength(7)
    expect(w.prevCutoffMs).toBeNull()
  })

  it('runs thirty days the same way', () => {
    const w = windowFor('30d', now, TZ)
    expect(datesBetween(w.from, w.to)).toHaveLength(30)
    expect(datesBetween(w.prevFrom, w.prevTo)).toHaveLength(30)
    expect(w.prevTo).toBe(addOne(w.from, -1))
  })

  it('uses the shop clock to decide what day it is, not the server clock', () => {
    // 22:30 UTC on the 6th is 02:30 on the 7th in Dubai.
    const w = windowFor('today', new Date('2026-11-06T22:30:00Z'), TZ)
    expect(w.from).toBe('2026-11-07')
  })
})

function addOne(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

describe('the headline numbers', () => {
  it('counts revenue from paid orders only, and not from cancelled ones', () => {
    const orders = [
      order({ totalFils: 2500 }),
      order({ totalFils: 3000 }),
      order({ totalFils: 2000, paymentStatus: 'unpaid', method: 'cash', status: 'awaiting_payment' }),
      order({ totalFils: 9900, status: 'cancelled', paymentStatus: 'refunded' }),
    ]
    const k = kpisOf(orders, 1)
    expect(k.revenueFils).toBe(5500)
    expect(k.orders).toBe(3) // the unpaid one is an order; the cancelled one is not
    expect(k.cancelled).toBe(1)
  })

  it('averages order value over paid orders and rounds to a fil', () => {
    const k = kpisOf([order({ totalFils: 2500 }), order({ totalFils: 2501 }), order({ totalFils: 0, paymentStatus: 'unpaid', status: 'awaiting_payment', method: 'cash' })], 0)
    expect(k.avgOrderFils).toBe(2501) // (2500 + 2501) / 2 = 2500.5, rounded up
  })

  it('has no average when nothing was paid', () => {
    const k = kpisOf([order({ paymentStatus: 'unpaid', status: 'awaiting_payment', method: 'cash' })], 0)
    expect(k.revenueFils).toBe(0)
    expect(k.avgOrderFils).toBeNull()
  })

  it('averages prep time from start to ready, and the wait from queue to start', () => {
    const base = '2026-11-05'
    const orders = [
      order({ queueAt: at(base, '09:00'), startedAt: at(base, '09:01'), readyAt: at(base, '09:03') }), // wait 60s, prep 120s
      order({ queueAt: at(base, '10:00'), startedAt: at(base, '10:03'), readyAt: at(base, '10:08') }), // wait 180s, prep 300s
      order({ queueAt: at(base, '11:00') }), // not made: ignored by both
    ]
    const k = kpisOf(orders, 0)
    expect(k.avgPrepSeconds).toBe(210)
    expect(k.avgWaitSeconds).toBe(120)
  })

  it('never reports a negative wait for an order that started before its place in the queue', () => {
    const k = kpisOf([order({ queueAt: at('2026-11-05', '09:10'), startedAt: at('2026-11-05', '09:05'), readyAt: at('2026-11-05', '09:08') })], 0)
    expect(k.avgWaitSeconds).toBe(0)
  })

  it('works out the late rate over orders that have been made', () => {
    const made = { startedAt: at('2026-11-05', '09:01'), readyAt: at('2026-11-05', '09:04') }
    const k = kpisOf([order({ ...made, wasLate: true }), order({ ...made }), order({ ...made }), order({ ...made }), order({})], 0)
    expect(k.lateRate).toBe(0.25) // 1 of 4 made; the order not yet made is not counted
    expect(k.lateOrders).toBe(1)
    expect(kpisOf([order({})], 0).lateRate).toBeNull()
  })

  it('averages ratings and counts distinct customers', () => {
    const k = kpisOf([order({ userId: 1, rating: 5 }), order({ userId: 1, rating: 4 }), order({ userId: 2, rating: null }), order({ userId: 3, rating: 4 })], 0)
    expect(k.rating).toBe(4.33)
    expect(k.ratingCount).toBe(3)
    expect(k.customers).toBe(3)
    expect(kpisOf([order({})], 0).rating).toBeNull()
  })

  it('is all zeros and nulls for an empty period', () => {
    const k = kpisOf([], 0)
    expect(k).toMatchObject({ revenueFils: 0, orders: 0, avgOrderFils: null, avgPrepSeconds: null, lateRate: null, rating: null, customers: 0 })
  })

  it('compares with a previous period', () => {
    expect(change(150, 100)).toBe(0.5)
    expect(change(50, 100)).toBe(-0.5)
    expect(change(5, 0)).toBeNull()
    expect(change(null, 5)).toBeNull()
    expect(change(5, null)).toBeNull()
  })
})

describe('charts', () => {
  it('puts orders in the hour on the shop clock, not UTC', () => {
    const orders = [order({ time: '09:30' }), order({ time: '09:59' }), order({ time: '13:05' }), order({ time: '00:30', date: '2026-11-05' })]
    const hours = hoursOf(orders, TZ)
    expect(hours.find((h) => h.hour === 9)).toMatchObject({ orders: 2, revenueFils: 5000 })
    expect(hours.find((h) => h.hour === 13)?.orders).toBe(1)
    expect(hours.find((h) => h.hour === 0)?.orders).toBe(1)
  })

  it('fills in quiet hours so the chart has no gaps, and leaves cancelled orders out', () => {
    const hours = hoursOf([order({ time: '08:10' }), order({ time: '16:10', status: 'cancelled' })], TZ)
    expect(hours.map((h) => h.hour)).toEqual(Array.from({ length: 15 }, (_, i) => 7 + i))
    expect(hours.find((h) => h.hour === 16)?.orders).toBe(0)
    expect(hoursOf([], TZ)).toEqual([])
  })

  it('has one row per day, including days with no orders', () => {
    const days = daysOf([order({ date: '2026-11-03' }), order({ date: '2026-11-03' }), order({ date: '2026-11-05', totalFils: 4000 })], '2026-11-02', '2026-11-06')
    expect(days.map((d) => d.date)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06'])
    expect(days.map((d) => d.orders)).toEqual([0, 2, 0, 1, 0])
    expect(days[3].revenueFils).toBe(4000)
  })

  it('ranks items by units, with revenue to break a tie', () => {
    const items = itemsOf([
      line(1, 'Latte', { quantity: 2, unitPriceFils: 2500 }),
      line(2, 'Latte', { quantity: 1, unitPriceFils: 2500 }),
      line(3, 'Mocha', { quantity: 3, unitPriceFils: 2800 }),
      line(4, 'Muffin', { quantity: 3, unitPriceFils: 1200, kind: 'food' }),
    ])
    // All three sold 3 units. Mocha earned 8,400, Latte 7,500 and Muffin 3,600 fils.
    expect(items.map((i) => i.name)).toEqual(['Mocha', 'Latte', 'Muffin'])
    expect(items[1]).toMatchObject({ units: 3, revenueFils: 7500 })
    expect(items.find((i) => i.kind === 'food')?.name).toBe('Muffin')
  })

  it('splits sales by category, naming custom coffees', () => {
    const names = new Map([['espresso-bar', 'Espresso Bar'], ['tea', 'Tea']])
    const cats = categoriesOf(
      [line(1, 'Latte', { quantity: 2 }), line(2, 'Green Tea', { categorySlug: 'tea', quantity: 1, unitPriceFils: 2400 }), line(3, 'My Latte', { categorySlug: 'creations' }), line(4, 'Old', { categorySlug: null })],
      names,
    )
    expect(cats.map((c) => c.name)).toEqual(['Espresso Bar', 'Custom coffees', 'Other', 'Tea'])
    expect(cats[0]).toMatchObject({ units: 2, revenueFils: 5000 })
  })

  it('splits card from cash and now from pre-order, counting orders and paid revenue', () => {
    const s = splitsOf([
      order({ method: 'card', totalFils: 2500 }),
      order({ method: 'card', totalFils: 3000, pickupAt: at('2026-11-05', '12:00') }),
      order({ method: 'cash', totalFils: 2000 }),
      order({ method: 'cash', totalFils: 1800, paymentStatus: 'unpaid', status: 'awaiting_payment' }),
      order({ method: 'card', status: 'cancelled' }),
    ])
    expect(s.payment.card).toEqual({ orders: 2, revenueFils: 5500 })
    expect(s.payment.cash).toEqual({ orders: 2, revenueFils: 2000 })
    expect(s.timing).toEqual({ asap: 3, preorder: 1 })
  })
})

describe('new and returning customers', () => {
  const first = new Map<number, string>([
    [1, at('2026-10-01', '09:00')], // ordered long before this period
    [2, at('2026-11-04', '10:00')], // first ever order is in the period
    [3, at('2026-11-05', '08:00')], // first order is in the period, and they came back
  ])
  const second = order({ userId: 3, date: '2026-11-06' })
  const orders = [
    order({ userId: 1, date: '2026-11-05' }),
    { ...order({ userId: 2, date: '2026-11-04', time: '10:00' }), createdAt: at('2026-11-04', '10:00') },
    { ...order({ userId: 3, date: '2026-11-05', time: '08:00' }), createdAt: at('2026-11-05', '08:00') },
    second,
  ]

  it('counts a customer as new when their first ever order falls in the period', () => {
    const s = customerSplit(orders, first, '2026-11-01', '2026-11-07', TZ)
    expect(s.newCustomers).toBe(2)
    expect(s.returningCustomers).toBe(1)
  })

  it('counts first orders and repeat orders', () => {
    const s = customerSplit(orders, first, '2026-11-01', '2026-11-07', TZ)
    expect(s.firstTimeOrders).toBe(2)
    expect(s.repeatOrders).toBe(2)
  })

  it('treats everyone as returning when the period is after all their first orders', () => {
    const s = customerSplit(orders, first, '2026-11-10', '2026-11-12', TZ)
    expect(s.newCustomers).toBe(0)
  })
})

describe('queue length through the day', () => {
  const now = new Date(at('2026-11-07', '23:00')).getTime()

  it('averages how many orders were waiting in each half hour', () => {
    // One order waited from 08:00 to 08:10. In the 08:00 half hour there are six 5-minute samples
    // (08:00 to 08:25), and it was waiting at two of them (08:00 and 08:05).
    const waits = [order({ date: '2026-11-05', queueAt: at('2026-11-05', '08:00'), startedAt: at('2026-11-05', '08:10'), readyAt: at('2026-11-05', '08:13') })]
    const profile = queueProfile(waits, ['2026-11-05'], TZ, now)
    const bucket = profile.find((p) => p.label === '08:00')!
    expect(bucket.avg).toBeCloseTo(2 / 6, 2)
    expect(bucket.max).toBe(1)
    expect(profile.find((p) => p.label === '08:30')!.avg).toBe(0)
  })

  it('shows the worst day as well as the average', () => {
    const day = (date: string, extra: number) =>
      Array.from({ length: 1 + extra }, () => order({ date, queueAt: at(date, '12:00'), startedAt: at(date, '12:20'), readyAt: at(date, '12:23') }))
    const profile = queueProfile([...day('2026-11-04', 0), ...day('2026-11-05', 2)], ['2026-11-04', '2026-11-05'], TZ, now)
    const noon = profile.find((p) => p.label === '12:00')!
    expect(noon.max).toBe(3)
    expect(noon.avg).toBeGreaterThan(1)
    expect(noon.avg).toBeLessThan(3)
  })

  it('counts an order that is still waiting up to the present moment', () => {
    const justNow = new Date(at('2026-11-07', '09:12')).getTime()
    const waiting = order({ date: '2026-11-07', status: 'queued', queueAt: at('2026-11-07', '09:00') })
    const profile = queueProfile([waiting], ['2026-11-07'], TZ, justNow)
    expect(profile.find((p) => p.label === '09:00')!.max).toBe(1)
    // Nothing is claimed for the half hours that have not happened yet.
    expect(profile.find((p) => p.label === '10:00')!.avg).toBe(0)
  })

  it('ignores cancelled orders and orders with no place in the queue', () => {
    const profile = queueProfile(
      [order({ status: 'cancelled', queueAt: at('2026-11-05', '08:00'), startedAt: at('2026-11-05', '08:20') }), order({ queueAt: null })],
      ['2026-11-05'],
      TZ,
      now,
    )
    expect(Math.max(...profile.map((p) => p.max))).toBe(0)
  })

  it('covers the opening hours in half hour steps', () => {
    const profile = queueProfile([], ['2026-11-05'], TZ, now)
    expect(profile).toHaveLength(30)
    expect(profile[0].label).toBe('07:00')
    expect(profile[29].label).toBe('21:30')
  })
})

describe('slowest and least popular', () => {
  const made = (id: number, seconds: number) => {
    const o = order({ id, startedAt: at('2026-11-05', '09:00'), readyAt: new Date(Date.parse(at('2026-11-05', '09:00')) + seconds * 1000).toISOString() })
    return { ...o, id }
  }

  it('times an item only from orders where it was the one drink', () => {
    const orders = [made(101, 100), made(102, 200), made(103, 300), made(104, 900), made(105, 1000)]
    const lines = [
      line(101, 'Chemex'), line(102, 'Chemex'), line(103, 'Chemex'),
      // Order 104 has two drinks, so its time cannot be put down to either one.
      line(104, 'Chemex'), line(104, 'Latte'),
      // Order 105 is two of the same drink.
      line(105, 'Latte', { quantity: 2 }),
    ]
    const slow = slowestItems(orders, lines)
    expect(slow).toEqual([{ name: 'Chemex', avgSeconds: 200, samples: 3 }])
  })

  it('needs at least three samples, ignores food, and sorts slowest first', () => {
    const orders = [made(201, 60), made(202, 80), made(203, 100), made(204, 400), made(205, 420), made(206, 440), made(207, 30)]
    const lines = [line(201, 'Espresso'), line(202, 'Espresso'), line(203, 'Espresso'), line(204, 'V60'), line(205, 'V60'), line(206, 'V60'), line(207, 'Muffin', { kind: 'food' })]
    expect(slowestItems(orders, lines).map((s) => s.name)).toEqual(['V60', 'Espresso'])
    expect(slowestItems(orders, lines, 4)).toEqual([])
  })

  it('lists the least ordered menu items, including ones never ordered', () => {
    const items = itemsOf([line(1, 'Latte', { quantity: 5 }), line(2, 'Mocha', { quantity: 1 })])
    expect(leastPopular(['Latte', 'Mocha', 'Cortado', 'Affogato'], items, 3)).toEqual([
      { name: 'Affogato', units: 0 },
      { name: 'Cortado', units: 0 },
      { name: 'Mocha', units: 1 },
    ])
  })
})

describe('CSV', () => {
  it('quotes commas, quotes and line breaks', () => {
    expect(csvCell('plain')).toBe('plain')
    expect(csvCell('a,b')).toBe('"a,b"')
    expect(csvCell('say "hi"')).toBe('"say ""hi"""')
    expect(csvCell('two\nlines')).toBe('"two\nlines"')
  })

  it('keeps a customer-supplied formula from running in a spreadsheet', () => {
    for (const evil of ['=HYPERLINK("http://evil.example")', '+1+1', '-2+3', '@SUM(A1)', '\t=1', '\r=1']) {
      expect(csvCell(evil).replace(/^"/, '')).toMatch(/^'/)
    }
    expect(csvCell('Hot - iced')).toBe('Hot - iced')
  })

  it('leaves numbers, including negative ones, as numbers', () => {
    expect(csvCell(-5)).toBe('-5')
    expect(csvCell(12.5)).toBe('12.5')
    expect(csvCell(0)).toBe('0')
    expect(csvCell(null)).toBe('')
    expect(csvCell(undefined)).toBe('')
  })

  it('writes rows with Windows line endings and a byte order mark', () => {
    const csv = toCsv([['a', 'b'], [1, 'x,y']])
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toBe('\uFEFFa,b\r\n1,"x,y"\r\n')
  })
})
