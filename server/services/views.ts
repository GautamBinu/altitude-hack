import type {
  Board,
  OrderLineView,
  OrderStatus,
  OrderView,
  QueueInfo,
  QueueStatus,
  StaffOrderView,
} from '../../shared/types'
import { db } from '../db'
import {
  forecastScheduled,
  isLate,
  queueInfoFor,
  quoteNewOrder,
  type QueueEntry,
  type ScheduledEntry,
} from '../domain/queue'
import { pos } from '../pos'
import { businessDate, getSettings, type Settings } from './settings'

/* Read-only views of orders. Everything that leaves the server as an order goes through here. */

export interface OrderRow {
  id: number
  business_date: string
  number: number
  user_id: number
  customer_name: string
  fulfilment: 'takeaway' | 'dinein'
  table_number: string | null
  payment_method: 'card' | 'cash'
  payment_status: 'unpaid' | 'paid' | 'refunded'
  status: OrderStatus
  subtotal_fils: number
  total_fils: number
  code: string | null
  code_fils: number
  reward_id: string | null
  reward_points: number
  reward_fils: number
  pass_units: number
  pass_fils: number
  prep_seconds: number
  created_at: string
  confirmed_at: string | null
  queue_at: string | null
  pickup_at: string | null
  due_at: string | null
  started_at: string | null
  ready_at: string | null
  collected_at: string | null
  cancelled_at: string | null
  cancel_reason: string | null
  refunded: number
  was_late: number
  points_awarded: number
  rating: number | null
  rating_comment: string | null
  rated_at: string | null
  pos_order_id: string | null
  receipt_id: string | null
  is_seed: number
}

interface LineRow {
  id: number
  order_id: number
  name: string
  quantity: number
  unit_price_fils: number
  modifiers: string
  note: string | null
}

const ms = (iso: string | null): number | null => (iso ? Date.parse(iso) : null)

export function loadQueueEntries(): QueueEntry[] {
  const rows = db
    .prepare(
      `SELECT id, status, queue_at, confirmed_at, started_at, prep_seconds
       FROM orders WHERE status IN ('queued', 'preparing')`,
    )
    .all() as Pick<OrderRow, 'id' | 'status' | 'queue_at' | 'confirmed_at' | 'started_at' | 'prep_seconds'>[]
  return rows.map((r) => ({
    id: r.id,
    status: r.status as 'queued' | 'preparing',
    queueAtMs: ms(r.queue_at) ?? ms(r.confirmed_at) ?? 0,
    startedAtMs: ms(r.started_at),
    prepSeconds: r.prep_seconds,
  }))
}

export function loadScheduledEntries(): ScheduledEntry[] {
  const rows = db
    .prepare(`SELECT id, pickup_at, due_at, prep_seconds FROM orders WHERE status = 'scheduled' AND pickup_at IS NOT NULL`)
    .all() as Pick<OrderRow, 'id' | 'pickup_at' | 'due_at' | 'prep_seconds'>[]
  return rows.map((r) => ({
    id: r.id,
    pickupAtMs: Date.parse(r.pickup_at!),
    dueAtMs: ms(r.due_at) ?? Date.parse(r.pickup_at!) - r.prep_seconds * 1000,
    prepSeconds: r.prep_seconds,
  }))
}

function loadLines(orderIds: number[]): Map<number, OrderLineView[]> {
  const map = new Map<number, OrderLineView[]>()
  if (orderIds.length === 0) return map
  const marks = orderIds.map(() => '?').join(',')
  const rows = db
    .prepare(
      `SELECT id, order_id, name, quantity, unit_price_fils, modifiers, note
       FROM order_items WHERE order_id IN (${marks}) ORDER BY id`,
    )
    .all(...orderIds) as LineRow[]
  for (const row of rows) {
    const list = map.get(row.order_id) ?? []
    list.push({
      id: row.id,
      name: row.name,
      quantity: row.quantity,
      unitPriceFils: row.unit_price_fils,
      lineTotalFils: row.unit_price_fils * row.quantity,
      modifiers: JSON.parse(row.modifiers) as string[],
      note: row.note,
    })
    map.set(row.order_id, list)
  }
  return map
}

interface Context {
  entries: QueueEntry[]
  scheduled: ScheduledEntry[]
  settings: Settings
  nowMs: number
}

function loadContext(nowMs: number): Context {
  return { entries: loadQueueEntries(), scheduled: loadScheduledEntries(), settings: getSettings(), nowMs }
}

const EMPTY_QUEUE: QueueInfo = { ahead: null, etaSeconds: null, estimatedReadyAt: null }

function queueInfo(row: OrderRow, ctx: Context): QueueInfo {
  if (row.status === 'queued' || row.status === 'preparing') {
    const entry = ctx.entries.find((e) => e.id === row.id)
    if (!entry) return EMPTY_QUEUE
    const info = queueInfoFor(entry, ctx.entries, ctx.settings.baristas, ctx.nowMs)
    let readyMs = ctx.nowMs + info.etaSeconds * 1000
    // A pre-order that is on schedule is ready at its pickup time, not before it.
    const pickupMs = ms(row.pickup_at)
    if (pickupMs != null && row.status === 'queued') readyMs = Math.max(readyMs, pickupMs)
    return { ahead: info.ahead, etaSeconds: Math.round((readyMs - ctx.nowMs) / 1000), estimatedReadyAt: new Date(readyMs).toISOString() }
  }
  if (row.status === 'scheduled' && row.pickup_at) {
    const entry = ctx.scheduled.find((s) => s.id === row.id)
    if (!entry) return EMPTY_QUEUE
    const f = forecastScheduled(entry, ctx.entries, ctx.scheduled, ctx.settings.baristas, ctx.nowMs)
    return { ahead: f.ahead, etaSeconds: Math.round((f.readyAtMs - ctx.nowMs) / 1000), estimatedReadyAt: new Date(f.readyAtMs).toISOString() }
  }
  return EMPTY_QUEUE
}

function buildStaffViews(rows: OrderRow[], nowMs: number): StaffOrderView[] {
  const ctx = loadContext(nowMs)
  const lines = loadLines(rows.map((r) => r.id))
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    fulfilment: row.fulfilment,
    tableNumber: row.table_number,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    subtotalFils: row.subtotal_fils || row.total_fils,
    totalFils: row.total_fils,
    code: row.code,
    codeFils: row.code_fils,
    rewardPoints: row.reward_points,
    rewardFils: row.reward_fils,
    passUnits: row.pass_units,
    passFils: row.pass_fils,
    pointsAwarded: row.points_awarded,
    lines: lines.get(row.id) ?? [],
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    pickupAt: row.pickup_at,
    dueAt: row.due_at,
    startedAt: row.started_at,
    readyAt: row.ready_at,
    collectedAt: row.collected_at,
    cancelledAt: row.cancelled_at,
    cancelReason: row.cancel_reason,
    refunded: row.refunded === 1,
    rating: row.rating,
    ratingComment: row.rating_comment,
    queue: queueInfo(row, ctx),
    customerName: row.customer_name,
    receiptId: row.receipt_id,
    prepSeconds: row.prep_seconds,
    late: isLate(row.status, ms(row.queue_at) ?? ms(row.confirmed_at), nowMs, ctx.settings.lateAfterSeconds, ms(row.pickup_at), ctx.settings.preorderGraceSeconds),
  }))
}

/** Strip the fields only staff should see. */
function toCustomerView(view: StaffOrderView): OrderView {
  const { customerName: _name, receiptId: _receipt, prepSeconds: _prep, late: _late, ...order } = view
  return order
}

export function getOrderRow(id: number): OrderRow | undefined {
  return db.prepare('SELECT * FROM orders WHERE id = ?').get(id) as OrderRow | undefined
}

export function getStaffOrder(id: number): StaffOrderView | undefined {
  const row = getOrderRow(id)
  return row ? buildStaffViews([row], Date.now())[0] : undefined
}

/** One of a customer's own orders. Undefined when it does not exist or belongs to someone else. */
export function getOrderForUser(id: number, userId: number): OrderView | undefined {
  const row = getOrderRow(id)
  if (!row || row.user_id !== userId) return undefined
  return toCustomerView(buildStaffViews([row], Date.now())[0])
}

/** A customer's recent orders, newest first. Includes finished ones so history stays visible. */
export function listOrdersForUser(userId: number, limit = 15): OrderView[] {
  const rows = db
    .prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC LIMIT ?')
    .all(userId, limit) as OrderRow[]
  return buildStaffViews(rows, Date.now()).map(toCustomerView)
}

/** Everything the dashboard queue screen shows, in one snapshot. */
export function getBoard(): Board {
  const settings = getSettings()
  const nowMs = Date.now()
  const today = businessDate(new Date(nowMs), settings.timezone)
  const rows = db
    .prepare(
      `SELECT * FROM orders
       WHERE status IN ('awaiting_payment', 'scheduled', 'queued', 'preparing', 'ready')
          OR (status IN ('collected', 'cancelled') AND business_date = ?)
       ORDER BY id`,
    )
    .all(today) as OrderRow[]
  const queueKeys = new Map(rows.map((r) => [r.id, r.queue_at ?? r.confirmed_at ?? r.created_at]))
  const views = buildStaffViews(rows, nowMs)
  const byQueue = (a: StaffOrderView, b: StaffOrderView) =>
    Date.parse(queueKeys.get(a.id)!) - Date.parse(queueKeys.get(b.id)!) || a.id - b.id
  const status = pos.status()
  return {
    serverNow: new Date(nowMs).toISOString(),
    lateAfterSeconds: settings.lateAfterSeconds,
    pos: { label: status.label, connected: status.connected },
    awaiting: views.filter((v) => v.status === 'awaiting_payment').sort((a, b) => a.id - b.id),
    scheduled: views
      .filter((v) => v.status === 'scheduled')
      .sort((a, b) => Date.parse(a.pickupAt ?? a.createdAt) - Date.parse(b.pickupAt ?? b.createdAt) || a.id - b.id),
    queue: views.filter((v) => v.status === 'queued' || v.status === 'preparing').sort(byQueue),
    ready: views
      .filter((v) => v.status === 'ready')
      .sort((a, b) => Date.parse(a.readyAt ?? a.createdAt) - Date.parse(b.readyAt ?? b.createdAt)),
    completed: views
      .filter((v) => v.status === 'collected' || v.status === 'cancelled')
      .sort((a, b) => Date.parse(b.collectedAt ?? b.cancelledAt ?? '') - Date.parse(a.collectedAt ?? a.cancelledAt ?? ''))
      .slice(0, 40),
  }
}

/** How busy it is right now, for people who have not ordered yet. */
export function getQueueStatus(): QueueStatus {
  const entries = loadQueueEntries()
  const settings = getSettings()
  const info = quoteNewOrder(settings.typicalDrinkPrepSeconds, entries, settings.baristas, Date.now())
  return { inQueue: entries.length, estimateSeconds: info.etaSeconds }
}
