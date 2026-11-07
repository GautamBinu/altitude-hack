import { tierFor } from '../../shared/loyalty'
import type { StatsRange, StatsResponse } from '../../shared/stats'
import { db } from '../db'
import { toCsv } from '../domain/csv'
import {
  categoriesOf,
  customerSplit,
  daysOf,
  datesBetween,
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
} from '../domain/stats'
import { addDays, zonedTimeToUtc } from '../domain/time'
import { getSettings } from './settings'

interface OrderRow {
  id: number
  number: number
  user_id: number
  customer_name: string
  business_date: string
  created_at: string
  fulfilment: 'takeaway' | 'dinein'
  payment_method: 'card' | 'cash'
  payment_status: string
  status: string
  total_fils: number
  pickup_at: string | null
  queue_at: string | null
  started_at: string | null
  ready_at: string | null
  was_late: number
  rating: number | null
  points_awarded: number
}

const toOrder = (r: OrderRow): StatOrder => ({
  id: r.id,
  number: r.number,
  userId: r.user_id,
  customerName: r.customer_name,
  businessDate: r.business_date,
  createdAt: r.created_at,
  fulfilment: r.fulfilment,
  method: r.payment_method,
  paymentStatus: r.payment_status,
  status: r.status,
  totalFils: r.total_fils,
  pickupAt: r.pickup_at,
  queueAt: r.queue_at,
  startedAt: r.started_at,
  readyAt: r.ready_at,
  wasLate: r.was_late === 1,
  rating: r.rating,
  pointsAwarded: r.points_awarded,
})

const ORDER_COLUMNS = `id, number, user_id, customer_name, business_date, created_at, fulfilment, payment_method, payment_status, status,
  total_fils, pickup_at, queue_at, started_at, ready_at, was_late, rating, points_awarded`

function loadOrders(from: string, to: string): StatOrder[] {
  const rows = db.prepare(`SELECT ${ORDER_COLUMNS} FROM orders WHERE business_date BETWEEN ? AND ? ORDER BY id`).all(from, to) as OrderRow[]
  return rows.map(toOrder)
}

interface LineRow {
  order_id: number
  name: string
  kind: 'drink' | 'food'
  category_slug: string | null
  quantity: number
  unit_price_fils: number
}

function loadLines(from: string, to: string, includeCancelled = false): StatLine[] {
  const rows = db
    .prepare(
      `SELECT oi.order_id, oi.name, oi.kind, COALESCE(oi.category_slug, c.slug) AS category_slug, oi.quantity, oi.unit_price_fils
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       LEFT JOIN items i ON i.id = oi.item_id
       LEFT JOIN categories c ON c.id = i.category_id
       WHERE o.business_date BETWEEN ? AND ? ${includeCancelled ? '' : `AND o.status != 'cancelled'`}
       ORDER BY oi.id`,
    )
    .all(from, to) as LineRow[]
  return rows.map((r) => ({
    orderId: r.order_id,
    name: r.name,
    kind: r.kind,
    categorySlug: r.category_slug,
    quantity: r.quantity,
    unitPriceFils: r.unit_price_fils,
  }))
}

/** Points handed out between two instants. */
function pointsIssued(fromIso: string, toIso: string): number {
  const row = db
    .prepare(`SELECT COALESCE(SUM(delta), 0) AS n FROM loyalty_ledger WHERE kind = 'earn' AND created_at >= ? AND created_at < ?`)
    .get(fromIso, toIso) as { n: number }
  return row.n
}

const instant = (date: string, timezone: string) => zonedTimeToUtc(date, '00:00', timezone)

export function getStats(range: StatsRange, now = new Date()): StatsResponse {
  const settings = getSettings()
  const tz = settings.timezone
  const w = windowFor(range, now, tz)
  const dates = datesBetween(w.from, w.to)

  const all = loadOrders(w.prevFrom, w.to)
  const inRange = (o: StatOrder, from: string, to: string) => o.businessDate >= from && o.businessDate <= to
  const current = all.filter((o) => inRange(o, w.from, w.to))
  const previous = all.filter((o) => inRange(o, w.prevFrom, w.prevTo) && (w.prevCutoffMs == null || Date.parse(o.createdAt) <= w.prevCutoffMs))
  const cancelledNow = current.filter((o) => o.status === 'cancelled').length
  const cancelledBefore = previous.filter((o) => o.status === 'cancelled').length

  const lines = loadLines(w.from, w.to)
  const items = itemsOf(lines)
  const categoryNames = new Map((db.prepare('SELECT slug, name FROM categories').all() as { slug: string; name: string }[]).map((c) => [c.slug, c.name]))
  const menuNames = (db.prepare('SELECT name FROM items WHERE hidden = 0').all() as { name: string }[]).map((r) => r.name)

  const firstOrderAt = new Map(
    (db.prepare(`SELECT user_id, MIN(created_at) AS first FROM orders WHERE status != 'cancelled' GROUP BY user_id`).all() as { user_id: number; first: string }[]).map((r) => [r.user_id, r.first]),
  )

  const start = instant(w.from, tz).toISOString()
  const end = instant(addDays(w.to, 1), tz).toISOString()
  const prevStart = instant(w.prevFrom, tz).toISOString()
  const prevEnd = w.prevCutoffMs != null ? new Date(w.prevCutoffMs).toISOString() : instant(addDays(w.prevTo, 1), tz).toISOString()

  const lifetimes = db
    .prepare(
      `SELECT COALESCE(SUM(CASE WHEN l.kind IN ('earn', 'adjust') THEN l.delta ELSE 0 END), 0) AS lifetime
       FROM users u LEFT JOIN loyalty_ledger l ON l.user_id = u.id GROUP BY u.id`,
    )
    .all() as { lifetime: number }[]
  const tierCounts = new Map(settings.tiers.map((t) => [t.name, 0]))
  for (const { lifetime } of lifetimes) {
    const tier = tierFor(lifetime, settings.tiers).name
    tierCounts.set(tier, (tierCounts.get(tier) ?? 0) + 1)
  }

  const splits = splitsOf(current)
  const popular = (kind: 'drink' | 'food') => items.find((i) => i.kind === kind) ?? null

  return {
    range,
    label: w.label,
    from: w.from,
    to: w.to,
    comparisonLabel: w.comparisonLabel,
    generatedAt: now.toISOString(),
    kpis: kpisOf(current, cancelledNow),
    previous: kpisOf(previous, cancelledBefore),
    hours: hoursOf(current, tz),
    days: daysOf(current, w.from, w.to),
    topItems: items.slice(0, 8),
    popularDrink: popular('drink'),
    popularSnack: popular('food'),
    categories: categoriesOf(lines, categoryNames),
    payment: splits.payment,
    timing: splits.timing,
    customerSplit: customerSplit(current, firstOrderAt, w.from, w.to, tz),
    loyalty: {
      pointsIssued: pointsIssued(start, end),
      previousPointsIssued: pointsIssued(prevStart, prevEnd),
      tiers: [...tierCounts].map(([name, customers]) => ({ name, customers })),
    },
    queue: queueProfile(current, dates, tz, now.getTime()),
    slowest: slowestItems(current, lines),
    leastPopular: leastPopular(menuNames, items),
  }
}

/* ---------- CSV ---------- */

export type ExportKind = 'orders' | 'items' | 'summary'

const aed = (fils: number) => (fils / 100).toFixed(2)

export function exportCsv(range: StatsRange, kind: ExportKind, now = new Date()): { filename: string; csv: string } {
  const tz = getSettings().timezone
  const w = windowFor(range, now, tz)
  const stem = `altitude-${kind}-${w.from}${w.from === w.to ? '' : `-to-${w.to}`}`
  const clock = new Intl.DateTimeFormat('en-GB', { timeZone: tz, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })

  if (kind === 'orders') {
    const orders = loadOrders(w.from, w.to)
    const itemsByOrder = new Map<number, string[]>()
    for (const l of loadLines(w.from, w.to, true)) itemsByOrder.set(l.orderId, [...(itemsByOrder.get(l.orderId) ?? []), `${l.quantity} x ${l.name}`])
    return {
      filename: `${stem}.csv`,
      csv: toCsv([
        ['Order', 'Date', 'Time', 'Customer', 'Type', 'Payment', 'Payment status', 'Status', 'Pickup time', 'Total (AED)', 'Points', 'Late', 'Rating', 'Items'],
        ...orders.map((o) => [
          o.number,
          o.businessDate,
          clock.format(new Date(o.createdAt)),
          o.customerName,
          o.fulfilment === 'dinein' ? 'Dine-in' : 'Take-away',
          o.method === 'card' ? 'Card' : 'Cash',
          o.paymentStatus,
          o.status,
          o.pickupAt ? clock.format(new Date(o.pickupAt)) : 'As soon as possible',
          aed(o.totalFils),
          o.pointsAwarded,
          o.wasLate ? 'Yes' : 'No',
          o.rating,
          (itemsByOrder.get(o.id) ?? []).join('; '),
        ]),
      ]),
    }
  }

  const stats = getStats(range, now)
  if (kind === 'items') {
    const lines = loadLines(w.from, w.to)
    const names = new Map((db.prepare('SELECT slug, name FROM categories').all() as { slug: string; name: string }[]).map((c) => [c.slug, c.name]))
    const categoryOf = new Map<string, string>()
    for (const l of lines) categoryOf.set(l.name, names.get(l.categorySlug ?? '') ?? (l.categorySlug === 'creations' ? 'Custom coffees' : 'Other'))
    return {
      filename: `${stem}.csv`,
      csv: toCsv([
        ['Item', 'Kind', 'Category', 'Units', 'Sales before discounts (AED)'],
        ...itemsOf(lines).map((i) => [i.name, i.kind === 'drink' ? 'Drink' : 'Food', categoryOf.get(i.name) ?? '', i.units, aed(i.revenueFils)]),
      ]),
    }
  }

  const k = stats.kpis
  const p = stats.previous
  const pct = (n: number | null) => (n == null ? '' : (n * 100).toFixed(1) + '%')
  const num = (n: number | null, digits = 0) => (n == null ? '' : n.toFixed(digits))
  return {
    filename: `${stem}.csv`,
    csv: toCsv([
      ['Metric', stats.label, `Compared with ${stats.comparisonLabel}`],
      ['Period', `${stats.from} to ${stats.to}`, ''],
      ['Revenue (AED)', aed(k.revenueFils), aed(p.revenueFils)],
      ['Orders', k.orders, p.orders],
      ['Cancelled orders', k.cancelled, p.cancelled],
      ['Average order value (AED)', k.avgOrderFils == null ? '' : aed(k.avgOrderFils), p.avgOrderFils == null ? '' : aed(p.avgOrderFils)],
      ['Average prep time (seconds)', num(k.avgPrepSeconds), num(p.avgPrepSeconds)],
      ['Average wait to start (seconds)', num(k.avgWaitSeconds), num(p.avgWaitSeconds)],
      ['Late rate', pct(k.lateRate), pct(p.lateRate)],
      ['Average rating', num(k.rating, 2), num(p.rating, 2)],
      ['Ratings given', k.ratingCount, p.ratingCount],
      ['Customers', k.customers, p.customers],
      ['Card orders', stats.payment.card.orders, ''],
      ['Cash orders', stats.payment.cash.orders, ''],
      ['As soon as possible orders', stats.timing.asap, ''],
      ['Pre-orders', stats.timing.preorder, ''],
      ['First-time customers', stats.customerSplit.newCustomers, ''],
      ['Returning customers', stats.customerSplit.returningCustomers, ''],
      ['Loyalty points issued', stats.loyalty.pointsIssued, stats.loyalty.previousPointsIssued],
      ...stats.loyalty.tiers.map((t) => [`Customers at ${t.name}`, t.customers, '']),
    ]),
  }
}
