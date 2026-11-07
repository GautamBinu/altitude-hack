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
import { queueInfoFor, quoteNewOrder, type QueueEntry } from '../domain/queue'
import { pos } from '../pos'
import { businessDate, getSettings } from './settings'

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
  payment_status: 'unpaid' | 'paid'
  status: OrderStatus
  total_fils: number
  prep_seconds: number
  created_at: string
  confirmed_at: string | null
  started_at: string | null
  ready_at: string | null
  collected_at: string | null
  pos_order_id: string | null
  receipt_id: string | null
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
      `SELECT id, status, confirmed_at, started_at, prep_seconds
       FROM orders WHERE status IN ('queued', 'preparing')`,
    )
    .all() as Pick<OrderRow, 'id' | 'status' | 'confirmed_at' | 'started_at' | 'prep_seconds'>[]
  return rows.map((r) => ({
    id: r.id,
    status: r.status as 'queued' | 'preparing',
    confirmedAtMs: ms(r.confirmed_at) ?? 0,
    startedAtMs: ms(r.started_at),
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

function queueInfo(row: OrderRow, entries: QueueEntry[], baristas: number, nowMs: number): QueueInfo {
  if (row.status !== 'queued' && row.status !== 'preparing') {
    return { ahead: null, etaSeconds: null, estimatedReadyAt: null }
  }
  const entry = entries.find((e) => e.id === row.id)
  if (!entry) return { ahead: null, etaSeconds: null, estimatedReadyAt: null }
  const info = queueInfoFor(entry, entries, baristas, nowMs)
  return {
    ahead: info.ahead,
    etaSeconds: info.etaSeconds,
    estimatedReadyAt: new Date(nowMs + info.etaSeconds * 1000).toISOString(),
  }
}

function buildStaffViews(rows: OrderRow[], nowMs: number): StaffOrderView[] {
  const entries = loadQueueEntries()
  const { baristas } = getSettings()
  const lines = loadLines(rows.map((r) => r.id))
  return rows.map((row) => ({
    id: row.id,
    number: row.number,
    status: row.status,
    fulfilment: row.fulfilment,
    tableNumber: row.table_number,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    totalFils: row.total_fils,
    lines: lines.get(row.id) ?? [],
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at,
    startedAt: row.started_at,
    readyAt: row.ready_at,
    collectedAt: row.collected_at,
    queue: queueInfo(row, entries, baristas, nowMs),
    customerName: row.customer_name,
    receiptId: row.receipt_id,
    prepSeconds: row.prep_seconds,
  }))
}

/** Strip the fields only staff should see. */
function toCustomerView(view: StaffOrderView): OrderView {
  const { customerName: _name, receiptId: _receipt, prepSeconds: _prep, ...order } = view
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

const byQueue = (a: StaffOrderView, b: StaffOrderView) =>
  (Date.parse(a.confirmedAt ?? a.createdAt) - Date.parse(b.confirmedAt ?? b.createdAt)) || a.id - b.id

/** Everything the dashboard queue screen shows, in one snapshot. */
export function getBoard(): Board {
  const settings = getSettings()
  const nowMs = Date.now()
  const today = businessDate(new Date(nowMs), settings.timezone)
  const rows = db
    .prepare(
      `SELECT * FROM orders
       WHERE status IN ('awaiting_payment', 'queued', 'preparing', 'ready')
          OR (status = 'collected' AND business_date = ?)
       ORDER BY id`,
    )
    .all(today) as OrderRow[]
  const views = buildStaffViews(rows, nowMs)
  const status = pos.status()
  return {
    serverNow: new Date(nowMs).toISOString(),
    lateAfterSeconds: settings.lateAfterSeconds,
    pos: { label: status.label, connected: status.connected },
    awaiting: views.filter((v) => v.status === 'awaiting_payment').sort((a, b) => a.id - b.id),
    queue: views.filter((v) => v.status === 'queued' || v.status === 'preparing').sort(byQueue),
    ready: views
      .filter((v) => v.status === 'ready')
      .sort((a, b) => Date.parse(a.readyAt ?? a.createdAt) - Date.parse(b.readyAt ?? b.createdAt)),
    completed: views
      .filter((v) => v.status === 'collected')
      .sort((a, b) => Date.parse(b.collectedAt ?? '') - Date.parse(a.collectedAt ?? ''))
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
