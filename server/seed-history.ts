import { pointsForOrder, tierFor } from '../shared/loyalty'
import { db } from './db'
import { priceLine, type PricedLine, type PricingItem } from './domain/pricing'
import { DEMO_STUDENT, SEED_REVIEW_COMMENTS, STUDENT_NAMES } from './seed-content'
import { loadPricingItems } from './services/menu'
import { addDays, businessDate, getSettings, weekdayIndex, zonedTimeToUtc } from './services/settings'

/**
 * Thirty days of synthetic order history, so Popular on campus, the loyalty tiers and Statistics have
 * something to show on first run. Every row is marked `is_seed` and none of it is Altitude's data.
 *
 * Shape of the days: weekday lunch (12 to 14) and mid-afternoon (15 to 16) peaks, a lighter weekend,
 * an exam-week surge, a mix of card and cash, a bias toward the espresso bar and iced drinks, and a
 * few pre-orders. The generator is seeded, so every fresh database gets the same history.
 */

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

type Rng = () => number
const pick = <T>(rng: Rng, list: T[]): T => list[Math.floor(rng() * list.length)]
const between = (rng: Rng, lo: number, hi: number) => lo + rng() * (hi - lo)
const chance = (rng: Rng, p: number) => rng() < p

/** Relative footfall by local hour. */
const HOUR_WEIGHT: Record<number, number> = {
  7: 0.5, 8: 1.2, 9: 1.4, 10: 1.0, 11: 1.1, 12: 2.0, 13: 2.4, 14: 1.8, 15: 1.9, 16: 1.5, 17: 0.9, 18: 0.5, 19: 0.3, 20: 0.15,
}
const HOURS = Object.keys(HOUR_WEIGHT).map(Number)

const CATEGORY_WEIGHT: Record<string, number> = {
  'espresso-bar': 5, 'manual-bar': 1.1, tea: 0.8, 'caffeine-free': 1.4, smoothies: 1.2,
  'real-milkshakes': 0.7, snacks: 0.9, food: 1.8, 'snow-ice': 0.3,
}
const ITEM_BOOST: Record<string, number> = {
  'cafe-latte': 2.4, 'flat-white': 1.7, americano: 1.5, 'spanish-latte': 1.9, 'caramel-cloud-latte': 2.6,
  croissants: 1.6, 'double-espresso': 1.2, 'red-eye': 0.8, 'death-eye': 0.5,
}
/** Items that only joined the menu recently: the day count is how far back their sales start. */
const NEW_ITEM_DAYS: Record<string, number> = { 'caramel-cloud-latte': 10 }
const NOTES = ['Extra hot', 'Less ice', 'No sugar', 'Oat foam please', 'Light on the milk', 'Cut in half']

interface SeedUser {
  id: number
  firstName: string
  weight: number
}

interface PlannedOrder {
  user: SeedUser
  createdMs: number
  dateStr: string
  lines: PricedLine[]
  prepSeconds: number
  fulfilment: 'takeaway' | 'dinein'
  table: string | null
  method: 'card' | 'cash'
  pickupMs: number | null
  rewardId: string | null
  collectedMs: number
  confirmedMs: number
  queueAtMs: number
  startedMs: number
  readyMs: number
  dueMs: number | null
  late: boolean
}

function chooseSelections(item: PricingItem, rng: Rng): Record<string, number[]> {
  const out: Record<string, number[]> = {}
  for (const group of item.groups) {
    const defaultOption = group.options.find((o) => o.isDefault) ?? group.options[0]
    if (group.kind === 'multi') {
      const count = Math.floor(rng() * 4)
      out[String(group.id)] = [...group.options].sort(() => rng() - 0.5).slice(0, count).map((o) => o.id)
    } else if (group.name === 'Temperature') {
      const iced = group.options.find((o) => o.name === 'Iced')
      out[String(group.id)] = [chance(rng, 0.62) && iced ? iced.id : defaultOption.id]
    } else if (group.inlineLabel && !group.showDefault) {
      // milk: mostly regular, sometimes an alternative
      const alternatives = group.options.filter((o) => !o.isDefault)
      out[String(group.id)] = [chance(rng, 0.14) && alternatives.length ? pick(rng, alternatives).id : defaultOption.id]
    } else if (group.name === 'Version') {
      out[String(group.id)] = [chance(rng, 0.3) ? (group.options.find((o) => !o.isDefault) ?? defaultOption).id : defaultOption.id]
    } else {
      out[String(group.id)] = [pick(rng, group.options).id]
    }
  }
  return out
}

function pickWeighted<T>(rng: Rng, entries: { value: T; weight: number }[]): T {
  const total = entries.reduce((s, e) => s + e.weight, 0)
  let r = rng() * total
  for (const e of entries) {
    r -= e.weight
    if (r <= 0) return e.value
  }
  return entries[entries.length - 1].value
}

/** Create the demo students and the demo student, returning them. */
export function seedStudents(): { students: SeedUser[]; demo: SeedUser } {
  const insert = db.prepare(
    `INSERT INTO users (google_sub, email, name, first_name, picture_url, is_demo, created_at)
     VALUES (?, NULL, ?, ?, NULL, 1, ?)
     ON CONFLICT (google_sub) DO UPDATE SET name = excluded.name
     RETURNING id`,
  )
  const created = new Date(Date.now() - 31 * 86_400_000).toISOString()
  const rng = mulberry32(7)
  const students = STUDENT_NAMES.map((name) => {
    const { id } = insert.get(`seed:${name.toLowerCase()}`, name, name, created) as { id: number }
    // A few regulars, a long tail of occasional visitors.
    return { id, firstName: name, weight: 0.1 + Math.pow(rng(), 3) * 2.9 }
  })
  const { id } = insert.get(DEMO_STUDENT.sub, DEMO_STUDENT.name, DEMO_STUDENT.firstName, created) as { id: number }
  return { students, demo: { id, firstName: DEMO_STUDENT.firstName, weight: 0 } }
}

export function seedHistory(): number {
  const settings = getSettings()
  const tz = settings.timezone
  const rng = mulberry32(20261107)
  const nowMs = Date.now()
  const todayStr = businessDate(new Date(nowMs), tz)

  const { students, demo } = seedStudents()

  const rows = db
    .prepare('SELECT i.id, i.slug, c.slug AS category FROM items i JOIN categories c ON c.id = i.category_id WHERE i.hidden = 0')
    .all() as { id: number; slug: string; category: string }[]
  const pricing = loadPricingItems(rows.map((r) => r.id))
  const slugOf = new Map(rows.map((r) => [r.id, r.slug]))
  const itemEntries = rows
    .filter((r) => pricing.has(r.id))
    .map((r) => ({ value: pricing.get(r.id)!, weight: (CATEGORY_WEIGHT[r.category] ?? 1) * (ITEM_BOOST[r.slug] ?? 1) }))

  const makeLines = (daysAgo: number): PricedLine[] => {
    const pool = itemEntries.filter((e) => {
      const limit = NEW_ITEM_DAYS[slugOf.get(e.value.id) ?? '']
      return limit == null || daysAgo <= limit
    })
    const count = pickWeighted(rng, [
      { value: 1, weight: 0.6 },
      { value: 2, weight: 0.3 },
      { value: 3, weight: 0.1 },
    ])
    const lines: PricedLine[] = []
    for (let i = 0; i < count; i++) {
      const item = pickWeighted(rng, pool)
      const quantity = pickWeighted(rng, [
        { value: 1, weight: 0.86 },
        { value: 2, weight: 0.12 },
        { value: 3, weight: 0.02 },
      ])
      lines.push(
        priceLine(item, {
          itemId: item.id,
          quantity,
          selections: chooseSelections(item, rng),
          note: chance(rng, 0.06) ? pick(rng, NOTES) : undefined,
        }),
      )
    }
    return lines
  }

  const planOrder = (user: SeedUser, createdMs: number, dateStr: string, hour: number, allowPreorder: boolean, daysAgo: number): PlannedOrder => {
    const lines = makeLines(daysAgo)
    const prepSeconds = lines.reduce((s, l) => s + l.prepSeconds * l.quantity, 0)
    const method = chance(rng, 0.72) ? 'card' : 'cash'
    const dineIn = chance(rng, 0.38)
    const load = HOUR_WEIGHT[hour] ?? 0.5
    const stress = 1 + (dateStr >= addDays(todayStr, -9) && dateStr <= addDays(todayStr, -5) ? 0.35 : 0)

    let pickupMs: number | null = null
    if (allowPreorder && chance(rng, 0.11)) {
      const raw = createdMs + between(rng, 25, 120) * 60_000
      const slot = settings.slotMinutes * 60_000
      pickupMs = Math.ceil(raw / slot) * slot
    }

    const actual = prepSeconds * between(rng, 0.85, 1.25) * 0.75
    let confirmedMs: number
    let queueAtMs: number
    let dueMs: number | null = null
    let startedMs: number
    let readyMs: number
    let collectedMs: number

    if (pickupMs != null) {
      dueMs = pickupMs - prepSeconds * 1000
      confirmedMs = method === 'card' ? createdMs : pickupMs - between(rng, 60, 300) * 1000
      queueAtMs = dueMs
      startedMs = dueMs + between(rng, 0, chance(rng, 0.12) ? 400 : 60) * 1000
      readyMs = startedMs + actual * 1000
      collectedMs = Math.max(readyMs + 20_000, pickupMs + between(rng, -60, 300) * 1000)
    } else {
      confirmedMs = createdMs + (method === 'card' ? 0 : between(rng, 40, 240) * 1000)
      queueAtMs = confirmedMs
      const rush = chance(rng, 0.045) ? between(rng, 280, 520) : 0
      const wait = (35 + 50 * load) * between(rng, 0.5, 1.5) * stress + rush
      startedMs = queueAtMs + wait * 1000
      readyMs = startedMs + actual * 1000
      collectedMs = readyMs + between(rng, 30, 360) * 1000
    }

    const late = pickupMs != null
      ? readyMs > pickupMs + settings.preorderGraceSeconds * 1000
      : (readyMs - queueAtMs) / 1000 > settings.lateAfterSeconds

    return {
      user,
      createdMs,
      dateStr,
      lines,
      prepSeconds,
      fulfilment: dineIn ? 'dinein' : 'takeaway',
      table: dineIn ? String(1 + Math.floor(rng() * 20)) : null,
      method,
      pickupMs,
      rewardId: null,
      collectedMs,
      confirmedMs,
      queueAtMs,
      startedMs,
      readyMs,
      dueMs,
      late,
    }
  }

  /* ---------- Plan every order ---------- */
  const planned: PlannedOrder[] = []
  const userEntries = students.map((s) => ({ value: s, weight: s.weight }))

  for (let d = 29; d >= 0; d--) {
    const dateStr = addDays(todayStr, -d)
    const noon = zonedTimeToUtc(dateStr, '12:00', tz)
    const wd = weekdayIndex(noon, tz)
    const weekend = wd >= 5
    let count = weekend ? (wd === 5 ? 10 : 6) : 30
    if (d >= 5 && d <= 9) count *= 1.5 // exam week
    else if (d >= 19 && d <= 21) count *= 1.2 // midterm week
    count = Math.round(count * between(rng, 0.88, 1.12))

    for (let i = 0; i < count; i++) {
      const hour = pickWeighted(rng, HOURS.map((h) => ({ value: h, weight: HOUR_WEIGHT[h] })))
      const minute = Math.floor(rng() * 60)
      const createdMs = zonedTimeToUtc(dateStr, `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`, tz).getTime() + Math.floor(rng() * 60_000)
      if (createdMs > nowMs - 15 * 60_000) continue
      const order = planOrder(pickWeighted(rng, userEntries), createdMs, dateStr, hour, !weekend, d)
      if (order.collectedMs > nowMs - 60_000) continue
      planned.push(order)
    }
  }

  // The demo student: enough orders over the month to sit in Gold, close to the deck's example.
  const demoDays = Array.from({ length: 29 }, (_, i) => 29 - i).filter(() => chance(rng, 0.6))
  for (const d of demoDays) {
    const dateStr = addDays(todayStr, -d)
    const hour = pick(rng, [8, 9, 12, 13, 15])
    const createdMs = zonedTimeToUtc(dateStr, `${String(hour).padStart(2, '0')}:${String(Math.floor(rng() * 50)).padStart(2, '0')}`, tz).getTime()
    if (createdMs > nowMs - 60 * 60_000) continue
    const order = planOrder(demo, createdMs, dateStr, hour, false, d)
    if (order.collectedMs <= nowMs - 60_000) planned.push(order)
  }

  planned.sort((a, b) => a.createdMs - b.createdMs)

  /* ---------- Write them ---------- */
  const insertOrder = db.prepare(
    `INSERT INTO orders (business_date, number, user_id, customer_name, fulfilment, table_number, payment_method,
                         payment_status, status, subtotal_fils, total_fils, reward_id, reward_points, reward_fils,
                         prep_seconds, created_at, confirmed_at, queue_at, pickup_at, due_at, started_at, ready_at,
                         collected_at, was_late, points_awarded, rating, rating_comment, rated_at, pos_order_id,
                         receipt_id, is_seed)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'paid', 'collected', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
  )
  const insertLine = db.prepare(
    `INSERT INTO order_items (order_id, item_id, name, quantity, unit_price_fils, prep_seconds, modifiers, note,
                             selections, kind, category_slug)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  )
  const insertEvent = db.prepare('INSERT INTO order_events (order_id, status, actor, at) VALUES (?, ?, ?, ?)')
  const nextNumber = db.prepare('SELECT COALESCE(MAX(number), 0) AS n FROM orders WHERE business_date = ?')

  const iso = (ms: number) => new Date(ms).toISOString()
  const numbers = new Map<string, number>()
  const running = new Map<number, { lifetime: number; balance: number }>()
  const ledger: { userId: number; at: string; delta: number; kind: 'earn' | 'redeem'; reason: string; orderId: number }[] = []
  let receiptSeq = 10_000

  for (const o of planned) {
    const subtotal = o.lines.reduce((s, l) => s + l.lineTotalFils, 0)
    const state = running.get(o.user.id) ?? { lifetime: 0, balance: 0 }
    const tier = tierFor(state.lifetime, settings.tiers)

    // Occasionally a member spends points on a reward. The demo student never does, so their balance
    // matches their tier progress.
    let rewardId: string | null = null
    let rewardPoints = 0
    let rewardFils = 0
    if (o.user.id !== demo.id) {
      const reward =
        state.balance >= 250 && tier.name !== 'Bronze' && chance(rng, 0.04)
          ? settings.rewards.find((r) => r.id === 'off-15')
          : state.balance >= 100 && chance(rng, 0.06)
            ? settings.rewards.find((r) => r.id === 'off-5')
            : undefined
      if (reward) {
        rewardId = reward.id
        rewardPoints = reward.costPoints
        rewardFils = Math.min(subtotal, reward.discountFils)
      }
    }
    const total = subtotal - rewardFils
    const points = pointsForOrder(total, tier.multiplier)

    const rated = chance(rng, 0.38)
    const stars = pickWeighted(rng, [
      { value: 5, weight: 55 }, { value: 4, weight: 28 }, { value: 3, weight: 11 }, { value: 2, weight: 4 }, { value: 1, weight: 2 },
    ])
    const comment = rated && chance(rng, 0.35) ? pick(rng, SEED_REVIEW_COMMENTS) : null
    const ratedAt = rated ? Math.min(nowMs - 1000, o.collectedMs + between(rng, 60, 1800) * 1000) : null

    const date = o.dateStr
    const number = (numbers.get(date) ?? (nextNumber.get(date) as { n: number }).n) + 1
    numbers.set(date, number)

    const { lastInsertRowid } = insertOrder.run(
      date, number, o.user.id, o.user.firstName, o.fulfilment, o.table, o.method,
      subtotal, total, rewardId, rewardPoints, rewardFils,
      o.prepSeconds, iso(o.createdMs), iso(o.confirmedMs), iso(o.queueAtMs),
      o.pickupMs ? iso(o.pickupMs) : null, o.dueMs ? iso(o.dueMs) : null,
      iso(o.startedMs), iso(o.readyMs), iso(o.collectedMs),
      o.late ? 1 : 0, points, rated ? stars : null, comment, ratedAt ? iso(ratedAt) : null,
      `SEED-ORD-${receiptSeq}`, `SEED-RCPT-${receiptSeq}`,
    )
    receiptSeq++
    const orderId = Number(lastInsertRowid)
    for (const l of o.lines) {
      insertLine.run(
        orderId, l.itemId, l.name, l.quantity, l.unitPriceFils, l.prepSeconds, JSON.stringify(l.modifiers), l.note,
        JSON.stringify(l.selections), l.kind, l.categorySlug,
      )
    }
    insertEvent.run(orderId, 'collected', 'seed', iso(o.collectedMs))

    if (rewardPoints > 0) {
      ledger.push({ userId: o.user.id, at: iso(o.createdMs), delta: -rewardPoints, kind: 'redeem', reason: 'Reward at checkout', orderId })
    }
    if (points > 0) {
      ledger.push({ userId: o.user.id, at: iso(o.collectedMs), delta: points, kind: 'earn', reason: `Order #${number}`, orderId })
    }
    running.set(o.user.id, { lifetime: state.lifetime + points, balance: state.balance + points - rewardPoints })
  }

  // Land the demo student on the deck's example, Gold with 1,240 points, when their orders came in under it.
  const demoState = running.get(demo.id) ?? { lifetime: 0, balance: 0 }
  if (demoState.lifetime < 1240) {
    ledger.push({ userId: demo.id, at: iso(nowMs - 3_600_000), delta: 1240 - demoState.lifetime, kind: 'earn', reason: 'Demo account starting points', orderId: 0 })
  }

  ledger.sort((a, b) => a.at.localeCompare(b.at))
  const insertLedger = db.prepare(
    'INSERT INTO loyalty_ledger (user_id, delta, kind, reason, order_id, created_at) VALUES (?, ?, ?, ?, ?, ?)',
  )
  for (const e of ledger) insertLedger.run(e.userId, e.delta, e.kind, e.reason, e.orderId || null, e.at)

  return planned.length
}
