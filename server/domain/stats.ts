import type {
  StatsCategory,
  StatsDay,
  StatsHour,
  StatsItem,
  StatsKpis,
  StatsQueuePoint,
  StatsRange,
} from '../../shared/stats'
import { addDays, businessDate, zonedTimeToUtc } from './time'

/*
 * Every number on the Statistics screen is worked out here from plain rows, with no database, so each
 * definition can be tested against orders built by hand. The definitions are written next to the code.
 */

export interface StatOrder {
  id: number
  number: number
  userId: number
  customerName: string
  businessDate: string
  createdAt: string
  fulfilment: 'takeaway' | 'dinein'
  method: 'card' | 'cash'
  paymentStatus: string
  status: string
  totalFils: number
  pickupAt: string | null
  queueAt: string | null
  startedAt: string | null
  readyAt: string | null
  wasLate: boolean
  rating: number | null
  pointsAwarded: number
}

export interface StatLine {
  orderId: number
  name: string
  kind: 'drink' | 'food'
  categorySlug: string | null
  quantity: number
  unitPriceFils: number
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)
const sum = (values: number[]): number => values.reduce((a, b) => a + b, 0)
const mean = (values: number[]): number | null => (values.length ? sum(values) / values.length : null)

/* ---------- Which days a range covers ---------- */

export interface Window {
  from: string
  to: string
  prevFrom: string
  prevTo: string
  label: string
  comparisonLabel: string
  /** For "today": the previous period only counts orders placed before this clock time yesterday. */
  prevCutoffMs: number | null
}

/**
 * Today is compared with yesterday up to the same time of day. Seven days and thirty days run up to and
 * including today, and are compared with the same number of days just before them.
 */
export function windowFor(range: StatsRange, now: Date, timezone: string): Window {
  const today = businessDate(now, timezone)
  if (range === 'today') {
    return {
      from: today,
      to: today,
      prevFrom: addDays(today, -1),
      prevTo: addDays(today, -1),
      label: 'Today',
      comparisonLabel: 'yesterday by this time',
      prevCutoffMs: now.getTime() - 24 * 3600_000,
    }
  }
  const days = range === '7d' ? 7 : 30
  return {
    from: addDays(today, -(days - 1)),
    to: today,
    prevFrom: addDays(today, -(2 * days - 1)),
    prevTo: addDays(today, -days),
    label: range === '7d' ? 'Last 7 days' : 'Last 30 days',
    comparisonLabel: `the ${days} days before`,
    prevCutoffMs: null,
  }
}

export function datesBetween(from: string, to: string): string[] {
  const out: string[] = []
  for (let d = from; d <= to && out.length < 400; d = addDays(d, 1)) out.push(d)
  return out
}

/* ---------- The headline numbers ---------- */

const countable = (o: StatOrder) => o.status !== 'cancelled'
const paid = (o: StatOrder) => countable(o) && o.paymentStatus === 'paid'

/**
 * Revenue is money actually taken: paid orders that were not cancelled, after discounts. Orders counts every
 * order that was not cancelled, paid or not. Average order value is revenue over paid orders. Prep time is
 * start of making to ready. Wait is the place in the queue to start of making. The late rate is over orders
 * that have been made, and uses the same "late" rule the dashboard shows.
 */
export function kpisOf(orders: StatOrder[], cancelled: number): StatsKpis {
  const live = orders.filter(countable)
  const paidOrders = live.filter(paid)
  const made = live.filter((o) => o.readyAt)
  const prep = live.flatMap((o) => (o.startedAt && o.readyAt ? [(Date.parse(o.readyAt) - Date.parse(o.startedAt)) / 1000] : []))
  const wait = live.flatMap((o) => (o.startedAt && o.queueAt ? [Math.max(0, (Date.parse(o.startedAt) - Date.parse(o.queueAt)) / 1000)] : []))
  const ratings = live.flatMap((o) => (o.rating != null ? [o.rating] : []))
  const late = made.filter((o) => o.wasLate).length
  const revenue = sum(paidOrders.map((o) => o.totalFils))
  const avgPrep = mean(prep)
  const avgWait = mean(wait)
  const avgRating = mean(ratings)
  return {
    revenueFils: revenue,
    orders: live.length,
    cancelled,
    avgOrderFils: paidOrders.length ? Math.round(revenue / paidOrders.length) : null,
    avgPrepSeconds: avgPrep == null ? null : Math.round(avgPrep),
    avgWaitSeconds: avgWait == null ? null : Math.round(avgWait),
    lateRate: made.length ? late / made.length : null,
    lateOrders: late,
    rating: avgRating == null ? null : Math.round(avgRating * 100) / 100,
    ratingCount: ratings.length,
    customers: new Set(live.map((o) => o.userId)).size,
  }
}

/* ---------- Charts ---------- */

const hourFormat = (timezone: string) => new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', hourCycle: 'h23' })

/** Orders and revenue for each hour of the day, in the shop's clock, for the hours the shop is likely to be open. */
export function hoursOf(orders: StatOrder[], timezone: string): StatsHour[] {
  const fmt = hourFormat(timezone)
  const buckets = new Map<number, StatsHour>()
  for (const o of orders.filter(countable)) {
    const hour = Number(fmt.format(new Date(o.createdAt)))
    const b = buckets.get(hour) ?? { hour, orders: 0, revenueFils: 0 }
    b.orders += 1
    if (paid(o)) b.revenueFils += o.totalFils
    buckets.set(hour, b)
  }
  if (buckets.size === 0) return []
  const first = Math.min(7, ...buckets.keys())
  const last = Math.max(21, ...buckets.keys())
  return Array.from({ length: last - first + 1 }, (_, i) => buckets.get(first + i) ?? { hour: first + i, orders: 0, revenueFils: 0 })
}

export function daysOf(orders: StatOrder[], from: string, to: string): StatsDay[] {
  const map = new Map(datesBetween(from, to).map((date) => [date, { date, orders: 0, revenueFils: 0 }]))
  for (const o of orders.filter(countable)) {
    const d = map.get(o.businessDate)
    if (!d) continue
    d.orders += 1
    if (paid(o)) d.revenueFils += o.totalFils
  }
  return [...map.values()]
}

export function itemsOf(lines: StatLine[]): StatsItem[] {
  const map = new Map<string, StatsItem>()
  for (const l of lines) {
    const item = map.get(l.name) ?? { name: l.name, kind: l.kind, units: 0, revenueFils: 0 }
    item.units += l.quantity
    item.revenueFils += l.quantity * l.unitPriceFils
    map.set(l.name, item)
  }
  return [...map.values()].sort((a, b) => b.units - a.units || b.revenueFils - a.revenueFils || a.name.localeCompare(b.name))
}

export function categoriesOf(lines: StatLine[], names: Map<string, string>): StatsCategory[] {
  const map = new Map<string, StatsCategory>()
  for (const l of lines) {
    const slug = l.categorySlug ?? 'other'
    const c = map.get(slug) ?? { slug, name: names.get(slug) ?? (slug === 'creations' ? 'Custom coffees' : 'Other'), units: 0, revenueFils: 0 }
    c.units += l.quantity
    c.revenueFils += l.quantity * l.unitPriceFils
    map.set(slug, c)
  }
  return [...map.values()].sort((a, b) => b.units - a.units || a.name.localeCompare(b.name))
}

export function splitsOf(orders: StatOrder[]) {
  const live = orders.filter(countable)
  const by = (test: (o: StatOrder) => boolean) => {
    const group = live.filter(test)
    return { orders: group.length, revenueFils: sum(group.filter(paid).map((o) => o.totalFils)) }
  }
  return {
    payment: { card: by((o) => o.method === 'card'), cash: by((o) => o.method === 'cash') },
    timing: { asap: live.filter((o) => !o.pickupAt).length, preorder: live.filter((o) => !!o.pickupAt).length },
  }
}

/**
 * A customer is new in this period if their very first order (ever) falls inside it. `firstOrderAt` maps each
 * customer to the time of their first order that was not cancelled.
 */
export function customerSplit(orders: StatOrder[], firstOrderAt: Map<number, string>, from: string, to: string, timezone: string) {
  const live = orders.filter(countable)
  const firstDate = (userId: number) => {
    const first = firstOrderAt.get(userId)
    return first ? businessDate(new Date(first), timezone) : null
  }
  let firstTime = 0
  const newCustomers = new Set<number>()
  const returning = new Set<number>()
  for (const o of live) {
    const first = firstDate(o.userId)
    const startsHere = first != null && first >= from && first <= to
    if (startsHere) newCustomers.add(o.userId)
    else returning.add(o.userId)
    if (firstOrderAt.get(o.userId) === o.createdAt) firstTime += 1
  }
  return {
    firstTimeOrders: firstTime,
    repeatOrders: live.length - firstTime,
    newCustomers: newCustomers.size,
    returningCustomers: returning.size,
  }
}

/**
 * How many orders were waiting to be started at each time of day. An order waits from its place in the queue
 * (`queueAt`) until making starts; one that has not started yet is still waiting now. The day is sampled every
 * five minutes. The line is the average across the days in the range, and the second figure is the worst day.
 */
export function queueProfile(orders: StatOrder[], dates: string[], timezone: string, nowMs: number, bucketMinutes = 30): StatsQueuePoint[] {
  const waits = orders
    .filter(countable)
    .flatMap((o) => {
      const from = ms(o.queueAt)
      if (from == null) return []
      const to = ms(o.startedAt) ?? (o.status === 'queued' ? nowMs : null)
      return to == null || to <= from ? [] : [{ date: o.businessDate, from, to }]
    })
  const byDate = new Map<string, { from: number; to: number }[]>()
  for (const w of waits) byDate.set(w.date, [...(byDate.get(w.date) ?? []), w])

  const startHour = 7
  const endHour = 22
  const buckets = ((endHour - startHour) * 60) / bucketMinutes
  const points: StatsQueuePoint[] = []
  const step = 5 * 60_000

  for (let b = 0; b < buckets; b++) {
    const minute = startHour * 60 + b * bucketMinutes
    let total = 0
    let samples = 0
    let max = 0
    for (const date of dates) {
      const open = zonedTimeToUtc(date, `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`, timezone).getTime()
      if (open > nowMs) continue
      const dayWaits = byDate.get(date) ?? []
      for (let t = open; t < open + bucketMinutes * 60_000 && t <= nowMs; t += step) {
        const n = dayWaits.filter((w) => w.from <= t && t < w.to).length
        total += n
        samples += 1
        if (n > max) max = n
      }
    }
    points.push({
      minute,
      label: `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`,
      avg: samples ? Math.round((total / samples) * 100) / 100 : 0,
      max,
    })
  }
  return points
}

/**
 * Items that took longest to make. An item's own time is only known when it was the only drink in the order, so
 * only single-unit orders count, and an item needs at least `minSamples` of them to be listed.
 */
export function slowestItems(orders: StatOrder[], lines: StatLine[], minSamples = 3, limit = 5) {
  const linesByOrder = new Map<number, StatLine[]>()
  for (const l of lines) linesByOrder.set(l.orderId, [...(linesByOrder.get(l.orderId) ?? []), l])
  const samples = new Map<string, number[]>()
  for (const o of orders.filter(countable)) {
    if (!o.startedAt || !o.readyAt) continue
    const own = linesByOrder.get(o.id) ?? []
    if (own.length !== 1 || own[0].quantity !== 1 || own[0].kind !== 'drink') continue
    const seconds = (Date.parse(o.readyAt) - Date.parse(o.startedAt)) / 1000
    if (seconds <= 0) continue
    samples.set(own[0].name, [...(samples.get(own[0].name) ?? []), seconds])
  }
  return [...samples.entries()]
    .filter(([, v]) => v.length >= minSamples)
    .map(([name, v]) => ({ name, avgSeconds: Math.round(mean(v)!), samples: v.length }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Menu items with the fewest sales in the period, including those not sold at all. */
export function leastPopular(menuNames: string[], items: StatsItem[], limit = 5) {
  const units = new Map(items.map((i) => [i.name, i.units]))
  return menuNames
    .map((name) => ({ name, units: units.get(name) ?? 0 }))
    .sort((a, b) => a.units - b.units || a.name.localeCompare(b.name))
    .slice(0, limit)
}

/** Percent change from the previous period to this one. Null when there is nothing to compare with. */
export function change(now: number | null, before: number | null): number | null {
  if (now == null || before == null || before === 0) return null
  return (now - before) / before
}
