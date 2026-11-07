import { pointsForOrder, tierFor, type RewardDef } from '../../shared/loyalty'
import type {
  CreateOrderInput,
  OrderAction,
  OrderLineInput,
  OrderView,
  QuoteResponse,
  StaffOrderView,
} from '../../shared/types'
import { db, inTransaction } from '../db'
import { applyDiscounts, type DiscountResult } from '../domain/discounts'
import { applyAction, initialState } from '../domain/orderMachine'
import { OrderError, priceOrder, type PricedOrder } from '../domain/pricing'
import { quoteNewOrder } from '../domain/queue'
import { pos } from '../pos'
import { publishChange } from '../realtime'
import { awardForOrder, balances, recordRedeem, resolveReward } from './loyalty'
import { loadPricingItems } from './menu'
import { businessDate, getSettings } from './settings'
import { getOrderForUser, getOrderRow, getStaffOrder, loadQueueEntries } from './views'

/** The most orders one customer can have in progress at once. Stops a runaway client flooding the queue. */
const MAX_OPEN_ORDERS_PER_CUSTOMER = 5

interface Plan {
  priced: PricedOrder
  discounts: DiscountResult
  reward: RewardDef | null
  notices: string[]
}

function priceLines(lines: OrderLineInput[]): PricedOrder {
  const items = loadPricingItems(lines.flatMap((l) => (l.itemId != null ? [l.itemId] : [])))
  return priceOrder(items, lines)
}

/**
 * Works out what an order costs and how it is discounted. One plan serves both the quote a customer
 * sees at checkout and the order that is actually placed, so the two can never disagree.
 *
 * When `strict` is false (quotes) a code or reward that cannot be used becomes a friendly notice and
 * the rest of the quote stands. When it is true (placing the order) the same problem is an error.
 */
function planOrder(userId: number | null, input: Pick<CreateOrderInput, 'lines' | 'rewardId'>, strict: boolean): Plan {
  const priced = priceLines(input.lines)
  const notices: string[] = []
  let reward: RewardDef | null = null

  if (input.rewardId) {
    if (userId == null) {
      if (strict) throw new OrderError('Sign in to use a reward.', 'signed_out', 401)
      notices.push('Sign in to use a reward.')
    } else {
      try {
        reward = resolveReward(userId, input.rewardId)
      } catch (error) {
        if (strict || !(error instanceof OrderError)) throw error
        notices.push(error.message)
      }
    }
  }

  const discounts = applyDiscounts({ subtotalFils: priced.subtotalFils, rewardFils: reward?.discountFils ?? 0 })
  return { priced, discounts, reward, notices }
}

/** What the order would cost and how long it would take, without placing it. */
export function quoteOrder(userId: number | null, input: Pick<CreateOrderInput, 'lines' | 'rewardId'>): QuoteResponse {
  const plan = planOrder(userId, input, false)
  const settings = getSettings()
  const info = quoteNewOrder(plan.priced.prepSeconds, loadQueueEntries(), settings.baristas, Date.now())

  let pointsToEarn = 0
  if (userId != null) {
    const { lifetime } = balances(userId)
    pointsToEarn = pointsForOrder(plan.discounts.totalFils, tierFor(lifetime, settings.tiers).multiplier)
  }

  return {
    lines: plan.priced.lines.map((l, i) => ({
      id: i,
      name: l.name,
      quantity: l.quantity,
      unitPriceFils: l.unitPriceFils,
      lineTotalFils: l.lineTotalFils,
      modifiers: l.modifiers,
      note: l.note,
    })),
    subtotalFils: plan.discounts.subtotalFils,
    codeFils: plan.discounts.codeFils,
    rewardFils: plan.discounts.rewardFils,
    passFils: plan.discounts.passFils,
    passUnits: 0,
    totalFils: plan.discounts.totalFils,
    pointsToEarn,
    ahead: info.ahead,
    etaSeconds: info.etaSeconds,
    readyAt: null,
    notices: plan.notices,
  }
}

/**
 * Place an order for a signed-in customer.
 *
 * Prices come from the menu in the database, never from the client. A card order is paid at once
 * (the card form in the app is a prototype and sends no card data), so it goes straight into the
 * queue. A cash order waits at the payment step until staff accept payment.
 */
export async function createOrder(
  customer: { id: number; firstName: string },
  input: CreateOrderInput,
): Promise<OrderView> {
  const settings = getSettings()

  const created = inTransaction(() => {
    const open = db
      .prepare(`SELECT COUNT(*) AS n FROM orders WHERE user_id = ? AND status NOT IN ('collected', 'cancelled')`)
      .get(customer.id) as { n: number }
    if (open.n >= MAX_OPEN_ORDERS_PER_CUSTOMER) {
      throw new OrderError(
        `You already have ${open.n} orders in progress. Collect one before ordering again.`,
        'too_many_open_orders',
        429,
      )
    }

    const plan = planOrder(customer.id, input, true)
    const { priced, discounts, reward } = plan
    const state = initialState(input.paymentMethod)
    const nowIso = new Date().toISOString()
    const date = businessDate(new Date(), settings.timezone)
    const { next } = db
      .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM orders WHERE business_date = ?')
      .get(date) as { next: number }
    const confirmed = state.status === 'queued' ? nowIso : null

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (business_date, number, user_id, customer_name, fulfilment, table_number,
                             payment_method, payment_status, status, subtotal_fils, total_fils,
                             reward_id, reward_points, reward_fils, prep_seconds,
                             created_at, confirmed_at, queue_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        date,
        next,
        customer.id,
        customer.firstName,
        input.fulfilment,
        input.fulfilment === 'dinein' ? (input.tableNumber ?? null) : null,
        input.paymentMethod,
        state.paymentStatus,
        state.status,
        discounts.subtotalFils,
        discounts.totalFils,
        reward?.id ?? null,
        reward?.costPoints ?? 0,
        discounts.rewardFils,
        priced.prepSeconds,
        nowIso,
        confirmed,
        confirmed,
      )
    const orderId = Number(lastInsertRowid)

    const insertLine = db.prepare(
      `INSERT INTO order_items (order_id, item_id, name, quantity, unit_price_fils, prep_seconds, modifiers, note,
                               selections, creation, kind, category_slug)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    for (const line of priced.lines) {
      insertLine.run(
        orderId,
        line.itemId,
        line.name,
        line.quantity,
        line.unitPriceFils,
        line.prepSeconds,
        JSON.stringify(line.modifiers),
        line.note,
        line.selections ? JSON.stringify(line.selections) : null,
        line.creation,
        line.kind,
        line.categorySlug,
      )
    }
    db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)').run(
      orderId,
      state.status,
      'customer',
      nowIso,
    )

    // Spend the points last, once we know everything else worked.
    if (reward) recordRedeem(customer.id, reward.costPoints, orderId, reward.label)

    return { orderId, number: next, priced, discounts, state }
  })

  // Tell the dashboard straight away; the POS call below can take longer with a real integration.
  publishChange({ id: created.orderId, number: created.number })

  try {
    const { posOrderId } = await pos.createOrder({
      orderId: created.orderId,
      orderNumber: created.number,
      totalFils: created.discounts.totalFils,
      lines: created.priced.lines.map((l) => ({
        name: l.name,
        quantity: l.quantity,
        unitPriceFils: l.unitPriceFils,
      })),
    })
    let receiptId: string | null = null
    if (created.state.paymentStatus === 'paid') {
      receiptId = (
        await pos.markPaid(posOrderId, { method: input.paymentMethod, amountFils: created.discounts.totalFils })
      ).receiptId
    }
    db.prepare('UPDATE orders SET pos_order_id = ?, receipt_id = ? WHERE id = ?').run(posOrderId, receiptId, created.orderId)
    publishChange()
  } catch (error) {
    // The order is already saved and in the queue. A POS outage must not lose a customer's order.
    console.error('[pos] sync failed for order', created.orderId, error)
  }

  const view = getOrderForUser(created.orderId, customer.id)
  if (!view) throw new OrderError('Could not load the new order.', 'internal', 500)
  return view
}

const COLUMN_UPDATES: Record<OrderAction, string> = {
  accept_payment: `payment_status = 'paid', status = 'queued', confirmed_at = @at, queue_at = @at`,
  start: `status = 'preparing', started_at = @at`,
  ready: `status = 'ready', ready_at = @at, was_late = @late`,
  collect: `status = 'collected', collected_at = @at`,
}

const EVENT_STATUS: Record<OrderAction, string> = {
  accept_payment: 'queued',
  start: 'preparing',
  ready: 'ready',
  collect: 'collected',
}

/** Move an order forward on staff's say-so. The state machine decides whether the move is allowed. */
export async function transitionOrder(
  orderId: number,
  action: OrderAction,
  actor: string,
): Promise<StaffOrderView> {
  inTransaction(() => {
    const row = getOrderRow(orderId)
    if (!row) throw new OrderError('Order not found.', 'not_found', 404)

    const result = applyAction({ status: row.status, paymentStatus: row.payment_status }, action)
    if (!result.ok) throw new OrderError(result.message, result.code, 409)

    const settings = getSettings()
    const atMs = Date.now()
    const at = new Date(atMs).toISOString()
    const queueAt = Date.parse(row.queue_at ?? row.confirmed_at ?? row.created_at)
    const late = (atMs - queueAt) / 1000 > settings.lateAfterSeconds ? 1 : 0

    // Guard on the old state so two staff pressing at once cannot both succeed.
    const info = db
      .prepare(`UPDATE orders SET ${COLUMN_UPDATES[action]} WHERE id = @id AND status = @status AND payment_status = @payment`)
      .run({ at, late, id: orderId, status: row.status, payment: row.payment_status })
    if (info.changes !== 1) {
      throw new OrderError('Someone just updated this order. The board has been refreshed.', 'conflict', 409)
    }
    db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)').run(
      orderId,
      EVENT_STATUS[action],
      actor,
      at,
    )

    // Points are earned when the order is collected, on what was actually paid.
    if (action === 'collect' && row.total_fils > 0) {
      awardForOrder(orderId, row.user_id, row.number, row.total_fils)
    }
  })

  publishChange()

  if (action === 'accept_payment') {
    const row = getOrderRow(orderId)
    if (row) {
      try {
        const posOrderId =
          row.pos_order_id ??
          (
            await pos.createOrder({
              orderId: row.id,
              orderNumber: row.number,
              totalFils: row.total_fils,
              lines: [],
            })
          ).posOrderId
        const { receiptId } = await pos.markPaid(posOrderId, { method: 'cash', amountFils: row.total_fils })
        db.prepare('UPDATE orders SET pos_order_id = ?, receipt_id = ? WHERE id = ?').run(posOrderId, receiptId, orderId)
        publishChange()
      } catch (error) {
        console.error('[pos] could not record cash payment for order', orderId, error)
      }
    }
  }

  const view = getStaffOrder(orderId)
  if (!view) throw new OrderError('Order not found.', 'not_found', 404)
  return view
}
