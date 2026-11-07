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
import { applyAction, applyCancel, initialState } from '../domain/orderMachine'
import { OrderError, priceOrder, type PricedOrder } from '../domain/pricing'
import { forecastScheduled, quoteNewOrder } from '../domain/queue'
import { pos } from '../pos'
import { publishChange } from '../realtime'
import { awardForOrder, balances, recordRedeem, recordRefund, resolveReward } from './loyalty'
import { makeCreationPricer } from './builder'
import { loadPricingItems } from './menu'
import { consumeCode, releaseCode, resolveCode, type ResolvedCode } from './promotions'
import { businessDate, getSettings } from './settings'
import { validateSlot } from './slots'
import { getOrderForUser, getOrderRow, getStaffOrder, loadQueueEntries, loadScheduledEntries } from './views'

/** The most orders one customer can have in progress at once. Stops a runaway client flooding the queue. */
const MAX_OPEN_ORDERS_PER_CUSTOMER = 5

interface Plan {
  priced: PricedOrder
  discounts: DiscountResult
  reward: RewardDef | null
  code: ResolvedCode | null
  notices: string[]
}

type PlanInput = Pick<CreateOrderInput, 'lines' | 'rewardId' | 'code'>

function priceLines(lines: OrderLineInput[]): PricedOrder {
  const items = loadPricingItems(lines.flatMap((l) => (l.itemId != null ? [l.itemId] : [])))
  return priceOrder(items, lines, makeCreationPricer())
}

/**
 * Works out what an order costs and how it is discounted. One plan serves both the quote a customer
 * sees at checkout and the order that is actually placed, so the two can never disagree.
 *
 * When `strict` is false (quotes) a code or reward that cannot be used becomes a friendly notice and
 * the rest of the quote stands. When it is true (placing the order) the same problem is an error.
 */
function planOrder(userId: number | null, input: PlanInput, strict: boolean): Plan {
  const priced = priceLines(input.lines)
  const notices: string[] = []
  let reward: RewardDef | null = null
  let code: ResolvedCode | null = null

  if (input.code?.trim()) {
    try {
      code = resolveCode(input.code)
    } catch (error) {
      if (strict || !(error instanceof OrderError)) throw error
      notices.push(error.message)
    }
  }

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

  const discounts = applyDiscounts({
    subtotalFils: priced.subtotalFils,
    code: code ? { kind: code.kind, value: code.value } : null,
    rewardFils: reward?.discountFils ?? 0,
  })
  return { priced, discounts, reward, code, notices }
}

/** What the order would cost and how long it would take, without placing it. */
export function quoteOrder(userId: number | null, input: PlanInput & { pickupAt?: string }): QuoteResponse {
  const plan = planOrder(userId, input, false)
  const settings = getSettings()
  const nowMs = Date.now()
  const queue = loadQueueEntries()
  let { ahead, etaSeconds } = quoteNewOrder(plan.priced.prepSeconds, queue, settings.baristas, nowMs)
  let readyAt: string | null = null

  if (input.pickupAt) {
    try {
      const pickup = validateSlot(input.pickupAt, nowMs)
      const prepMs = plan.priced.prepSeconds * 1000
      const forecast = forecastScheduled(
        { id: Number.MAX_SAFE_INTEGER, pickupAtMs: pickup.getTime(), dueAtMs: pickup.getTime() - prepMs, prepSeconds: plan.priced.prepSeconds },
        queue,
        loadScheduledEntries(),
        settings.baristas,
        nowMs,
      )
      ahead = forecast.ahead
      etaSeconds = Math.round((forecast.readyAtMs - nowMs) / 1000)
      readyAt = new Date(Math.max(forecast.readyAtMs, pickup.getTime())).toISOString()
    } catch (error) {
      if (!(error instanceof OrderError)) throw error
      plan.notices.push(error.message)
    }
  }

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
    ahead,
    etaSeconds,
    readyAt,
    notices: plan.notices,
  }
}

/**
 * Place an order for a signed-in customer.
 *
 * Prices come from the menu in the database, never from the client. A card order is paid at once
 * (the card form in the app is a prototype and sends no card data), so it goes straight into the
 * queue, or onto the Scheduled lane when it is a pre-order that is not due to start yet. A cash order
 * waits at the payment step until staff accept payment.
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
    const { priced, discounts, reward, code } = plan
    const nowMs = Date.now()
    const nowIso = new Date(nowMs).toISOString()

    // A pre-order is checked against the slot rules inside the same transaction that saves it, so two
    // people can never take the last place in a slot at once.
    const pickup = input.pickupAt ? validateSlot(input.pickupAt, nowMs) : null
    const dueMs = pickup ? pickup.getTime() - priced.prepSeconds * 1000 : null
    const scheduled = dueMs != null && dueMs > nowMs

    if (code && !consumeCode(code.id)) throw new OrderError('That code has been used up.', 'code_used_up', 409)
    const state = initialState(input.paymentMethod, scheduled)
    const date = businessDate(new Date(nowMs), settings.timezone)
    const { next } = db
      .prepare('SELECT COALESCE(MAX(number), 0) + 1 AS next FROM orders WHERE business_date = ?')
      .get(date) as { next: number }
    const paidNow = state.paymentStatus === 'paid'
    // Queue key: when a paid order takes its place in the queue. A pre-order takes it when it is due to start.
    const queueAt = paidNow ? (scheduled && dueMs != null ? new Date(dueMs).toISOString() : nowIso) : null

    const { lastInsertRowid } = db
      .prepare(
        `INSERT INTO orders (business_date, number, user_id, customer_name, fulfilment, table_number,
                             payment_method, payment_status, status, subtotal_fils, total_fils,
                             code, code_fils, reward_id, reward_points, reward_fils, prep_seconds,
                             created_at, confirmed_at, queue_at, pickup_at, due_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
        code?.code ?? null,
        discounts.codeFils,
        reward?.id ?? null,
        reward?.costPoints ?? 0,
        discounts.rewardFils,
        priced.prepSeconds,
        nowIso,
        paidNow ? nowIso : null,
        queueAt,
        pickup ? pickup.toISOString() : null,
        dueMs != null ? new Date(dueMs).toISOString() : null,
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

    const settings = getSettings()
    const atMs = Date.now()
    const at = new Date(atMs).toISOString()
    const dueMs = row.due_at ? Date.parse(row.due_at) : null
    const dueInFuture = dueMs != null && dueMs > atMs

    const result = applyAction({ status: row.status, paymentStatus: row.payment_status }, action, { dueInFuture })
    if (!result.ok) throw new OrderError(result.message, result.code, 409)

    const queueAtMs = Date.parse(row.queue_at ?? row.confirmed_at ?? row.created_at)
    const pickupMs = row.pickup_at ? Date.parse(row.pickup_at) : null
    const late = (pickupMs != null ? atMs - pickupMs > settings.preorderGraceSeconds * 1000 : (atMs - queueAtMs) / 1000 > settings.lateAfterSeconds) ? 1 : 0

    const sets: Record<OrderAction, string> = {
      // A pre-order keeps its place in the queue (its due time); an as-soon-as-possible order takes its place now.
      accept_payment: `payment_status = 'paid', status = @next, confirmed_at = @at, queue_at = @queueAt`,
      start: `status = 'preparing', started_at = @at`,
      ready: `status = 'ready', ready_at = @at, was_late = @late`,
      collect: `status = 'collected', collected_at = @at`,
    }

    // Guard on the old state so two staff pressing at once cannot both succeed.
    const info = db
      .prepare(`UPDATE orders SET ${sets[action]} WHERE id = @id AND status = @status AND payment_status = @payment`)
      .run({
        at,
        late,
        next: result.next.status,
        queueAt: dueMs != null && dueInFuture ? row.due_at : at,
        id: orderId,
        status: row.status,
        payment: row.payment_status,
      })
    if (info.changes !== 1) {
      throw new OrderError('Someone just updated this order. The board has been refreshed.', 'conflict', 409)
    }
    db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)').run(
      orderId,
      action === 'accept_payment' ? result.next.status : EVENT_STATUS[action],
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

/**
 * Cancel an order. Reward points that were spent on it go back, a discount code's use is given back, and a
 * paid card order can be refunded. The reason is shown to the customer.
 */
export async function cancelOrder(
  orderId: number,
  input: { reason: string; refund: boolean },
  actor: string,
): Promise<StaffOrderView> {
  const reason = input.reason.replace(/\s+/g, ' ').trim().slice(0, 140)
  if (!reason) throw new OrderError('Add a reason so the customer knows why.', 'invalid_request')

  const outcome = inTransaction(() => {
    const row = getOrderRow(orderId)
    if (!row) throw new OrderError('Order not found.', 'not_found', 404)
    const result = applyCancel({ status: row.status, paymentStatus: row.payment_status }, input.refund, row.payment_method)
    if (!result.ok) throw new OrderError(result.message, 'wrong_state', 409)

    const at = new Date().toISOString()
    const info = db
      .prepare(
        `UPDATE orders SET status = 'cancelled', payment_status = ?, cancelled_at = ?, cancel_reason = ?, refunded = ?
         WHERE id = ? AND status = ? AND payment_status = ?`,
      )
      .run(result.next.paymentStatus, at, reason, result.refund ? 1 : 0, orderId, row.status, row.payment_status)
    if (info.changes !== 1) throw new OrderError('Someone just updated this order. The board has been refreshed.', 'conflict', 409)
    db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)').run(orderId, 'cancelled', actor, at)

    if (row.reward_points > 0) recordRefund(row.user_id, row.reward_points, orderId, row.number)
    releaseCode(row.code)
    return { posOrderId: row.pos_order_id, refund: result.refund }
  })

  publishChange()

  if (outcome.posOrderId) {
    try {
      await pos.voidOrder(outcome.posOrderId, outcome.refund ? `cancelled and refunded: ${reason}` : `cancelled: ${reason}`)
    } catch (error) {
      console.error('[pos] could not void order', orderId, error)
    }
  }

  const view = getStaffOrder(orderId)
  if (!view) throw new OrderError('Order not found.', 'not_found', 404)
  return view
}

/**
 * Moves pre-orders onto the live queue when it is time to start making them. They keep the place their
 * due-to-start time gives them, so they land behind everything confirmed before that moment and ahead of
 * everything confirmed after it. Runs once at start-up and then every few seconds (see server/index.ts).
 */
export function releaseDueOrders(nowMs = Date.now()): number {
  const nowIso = new Date(nowMs).toISOString()
  const due = db.prepare(`SELECT id FROM orders WHERE status = 'scheduled' AND due_at <= ?`).all(nowIso) as { id: number }[]
  if (due.length === 0) return 0
  inTransaction(() => {
    const update = db.prepare(`UPDATE orders SET status = 'queued' WHERE id = ? AND status = 'scheduled'`)
    const event = db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)')
    for (const { id } of due) {
      if (update.run(id).changes === 1) event.run(id, 'queued', 'schedule', nowIso)
    }
  })
  publishChange()
  return due.length
}
